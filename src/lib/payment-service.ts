// Payment Service
// Handles payment gateway routing, webhook verification, and checkout session creation
// Supports: Paystack (SA), Zoho Billing (International), Stripe (Fallback), LemonSqueezy (MoR)

import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

// ============================================
// PRODUCT DEFINITIONS
// ============================================

export const PRODUCTS: Record<string, { name: string; description: string }> = {
  'pitch-deck': { name: 'Pitch Deck Analyzer', description: 'AI-powered pitch deck analysis' },
  'elevator-script': { name: 'Script Check', description: 'Script analysis and improvement' },
  'elevator-live': { name: 'Live Elevator Pitch Coach', description: 'Video delivery analysis' },
  'pitch-deck-live': { name: 'Pitch Deck + Live Bundle', description: 'Combined deck and video analysis' },
  'master': { name: 'Master Plan', description: 'Full access to all modules' },
};

// ============================================
// SHARED PRODUCT → PLAN MAPPING
// ============================================

export function getPlanFromProduct(productId: string | null | undefined): 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' {
  if (!productId) return 'STARTER';
  const planMap: Record<string, 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'> = {
    'pitch-deck': 'STARTER',
    'elevator-script': 'STARTER',
    'elevator-live': 'PROFESSIONAL',
    'pitch-deck-live': 'PROFESSIONAL',
    'master': 'ENTERPRISE',
  };
  return planMap[productId] || 'STARTER';
}

export function getModuleCycles(productId: string): number {
  const cycleMap: Record<string, number> = {
    'pitch-deck': 2,
    'elevator-script': 2,
    'elevator-live': 5,
    'pitch-deck-live': 8,
    'master': 20,
  };
  return cycleMap[productId] || 0;
}

// ============================================
// COUNTRY & GATEWAY ROUTING
// ============================================

const AFRICAN_COUNTRIES_PAYSTACK = [
  'BF', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'DJ', 'ER', 'ET', 'GA', 'GH', 'GM',
  'GN', 'GQ', 'KE', 'KM', 'LR', 'LS', 'ML', 'MR', 'MW', 'MZ', 'NA', 'NE', 'NG', 'RW',
  'SD', 'SL', 'SN', 'SO', 'SS', 'ST', 'TD', 'TG', 'TZ', 'UG', 'ZA', 'ZM', 'ZW',
];

/**
 * Determine payment gateway based on user's country.
 * Paystack → African countries, Zoho Billing → International, Stripe → Fallback
 */
export function determinePaymentGateway(country: string): string {
  const code = country?.toUpperCase?.() || 'US';
  if (AFRICAN_COUNTRIES_PAYSTACK.includes(code)) return 'paystack';
  if (process.env.ZOHO_BILLING_AUTH_TOKEN) return 'zoho';
  if (process.env.STRIPE_SECRET_KEY) return 'stripe';
  return 'lemonsqueezy';
}

/**
 * Get price for a product in a specific country/currency.
 */
export function getPriceForCountry(productId: string, country: string): { amount: number; currency: string } {
  const africanCountry = AFRICAN_COUNTRIES_PAYSTACK.includes((country?.toUpperCase?.() || ''));
  const basePrices: Record<string, number> = {
    'pitch-deck': 29,
    'elevator-script': 29,
    'elevator-live': 49,
    'pitch-deck-live': 69,
    'master': 149,
  };

  const basePrice = basePrices[productId] || 29;

  if (africanCountry) {
    // Paystack prices in USD for African markets
    return { amount: basePrice, currency: 'USD' };
  }

  // International pricing
  return { amount: basePrice, currency: 'USD' };
}

// ============================================
// CHECKOUT SESSION CREATION
// ============================================

interface CustomerInfo {
  email: string;
  name: string;
  country: string;
  companyId: string;
}

interface SessionMetadata {
  userId: string;
  clerkId: string;
  productId: string;
  productName: string;
}

interface CheckoutSession {
  id: string;
  checkoutUrl: string;
  expiresAt?: string;
}

/**
 * Create a checkout session with the appropriate payment gateway.
 */
export async function createCheckoutSession(
  customer: CustomerInfo,
  productId: string,
  metadata: SessionMetadata
): Promise<CheckoutSession> {
  const gateway = determinePaymentGateway(customer.country);

  switch (gateway) {
    case 'paystack':
      return createPaystackSession(customer, productId, metadata);
    case 'zoho':
      return createZohoSession(customer, productId, metadata);
    case 'stripe':
      return createStripeSession(customer, productId, metadata);
    case 'lemonsqueezy':
      return createLemonSqueezySession(customer, productId, metadata);
    default:
      throw new Error('No payment gateway available');
  }
}

async function createPaystackSession(
  customer: CustomerInfo,
  productId: string,
  metadata: SessionMetadata
): Promise<CheckoutSession> {
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: customer.email,
      amount: getPriceForCountry(productId, customer.country).amount * 100,
      currency: 'USD',
      metadata: {
        custom_fields: [
          { display_name: 'Product', variable_name: 'product_id', value: productId },
          { display_name: 'User ID', variable_name: 'user_id', value: metadata.userId },
        ],
      },
    }),
  });

  const data = await response.json();
  if (!data.status) throw new Error('Paystack session creation failed');

  return {
    id: data.data.reference,
    checkoutUrl: data.data.authorization_url,
  };
}

async function createZohoSession(
  customer: CustomerInfo,
  productId: string,
  metadata: SessionMetadata
): Promise<CheckoutSession> {
  // Zoho Billing checkout session
  const response = await fetch(
    `https://billing.zoho.com/api/v3/hostedpages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-authtoken ${process.env.ZOHO_BILLING_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customer.companyId,
        product_id: productId,
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
        metadata: JSON.stringify(metadata),
      }),
    }
  );

  const data = await response.json();
  return {
    id: data.hostedpage?.hostedpage_id || `zoho-${Date.now()}`,
    checkoutUrl: data.hostedpage?.url || '',
  };
}

async function createStripeSession(
  customer: CustomerInfo,
  productId: string,
  metadata: SessionMetadata
): Promise<CheckoutSession> {
  const priceData: Record<string, string> = {
    'pitch-deck': process.env.STRIPE_PRICE_PITCH_DECK || '',
    'elevator-script': process.env.STRIPE_PRICE_ELEVATOR_SCRIPT || '',
    'elevator-live': process.env.STRIPE_PRICE_ELEVATOR_LIVE || '',
    'pitch-deck-live': process.env.STRIPE_PRICE_PITCH_DECK_LIVE || '',
    'master': process.env.STRIPE_PRICE_MASTER || '',
  };

  const priceId = priceData[productId];
  if (!priceId) throw new Error(`No Stripe price configured for ${productId}`);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode: 'payment',
      payment_method_types: 'card',
      line_items: JSON.stringify([{ price: priceId, quantity: 1 }]),
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?payment=cancelled`,
      client_reference_id: metadata.userId,
      metadata: JSON.stringify(metadata),
    }).toString(),
  });

  const data = await response.json();
  return {
    id: data.id,
    checkoutUrl: data.url,
    expiresAt: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : undefined,
  };
}

async function createLemonSqueezySession(
  customer: CustomerInfo,
  productId: string,
  metadata: SessionMetadata
): Promise<CheckoutSession> {
  const variantMap: Record<string, string> = {
    'pitch-deck': process.env.LEMONSQUEEZY_VARIANT_PITCH_DECK || '',
    'elevator-script': process.env.LEMONSQUEEZY_VARIANT_ELEVATOR_SCRIPT || '',
    'elevator-live': process.env.LEMONSQUEEZY_VARIANT_ELEVATOR_LIVE || '',
    'pitch-deck-live': process.env.LEMONSQUEEZY_VARIANT_PITCH_DECK_LIVE || '',
    'master': process.env.LEMONSQUEEZY_VARIANT_MASTER || '',
  };

  const variantId = variantMap[productId];
  if (!variantId) throw new Error(`No LemonSqueezy variant configured for ${productId}`);

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: customer.email,
            name: customer.name,
            custom: {
              userId: metadata.userId,
              productId,
            },
          },
        },
        relationships: {
          variant: {
            data: { type: 'variants', id: variantId },
          },
        },
      },
    }),
  });

  const data = await response.json();
  return {
    id: data.data?.id || `ls-${Date.now()}`,
    checkoutUrl: data.data?.attributes?.url || '',
  };
}

// ============================================
// MODULE ACCESS CREATION (single source of truth)
// ============================================

/**
 * Create a ModuleAccess record for a transaction based on the product ID.
 * Uses atomic upsert to prevent TOCTOU race conditions.
 *
 * This is the SINGLE source of truth for which products grant access to which modules,
 * and what usage limits each product tier provides. All payment webhooks MUST call
 * this function instead of inlining their own upsert logic.
 *
 * @param transactionId - The database transaction ID to link the module access to
 * @param productId - The product identifier (e.g. 'pitch-deck', 'master')
 */
export async function createModuleAccess(
  transactionId: string,
  productId: string
): Promise<void> {
  await prisma.moduleAccess.upsert({
    where: { transactionId },
    create: {
      transactionId,
      e1Access: ['pitch-deck', 'pitch-deck-live', 'master'].includes(productId),
      e2Access: ['elevator-script', 'elevator-live', 'master'].includes(productId),
      e3Access: ['elevator-live', 'pitch-deck-live', 'master'].includes(productId),
      e4Access: ['pitch-deck-live', 'master'].includes(productId),
      e5Access: ['founder', 'founder-readiness', 'master'].includes(productId),
      e1Limit: productId === 'master' ? 20 : productId === 'pitch-deck-live' ? 5 : 2,
      e2Limit: productId === 'master' ? 50 : productId === 'elevator-live' ? 10 : 2,
      e3Limit: productId === 'master' ? 30 : 3,
      e4Limit: productId === 'master' ? 10 : 3,
      e5Limit: productId === 'master' ? 20 : 5,
    },
    update: {}, // no-op if already exists (idempotent)
  });
}

// ============================================
// WEBHOOK VERIFICATION — TIMING-SAFE HMAC
// ============================================

/**
 * Verify Paystack webhook signature using timing-safe comparison.
 */
function verifyPaystackWebhook(signature: string, body: string): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) return false;
  const hash = createHmac('sha512', secret)
    .update(body)
    .digest('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const sigBuf = Buffer.from(signature, 'hex');
  if (hashBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(hashBuf, sigBuf);
}

/**
 * Verify LemonSqueezy webhook signature using timing-safe comparison.
 */
function verifyLemonSqueezyWebhook(signature: string, body: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return false;
  const hash = createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const sigBuf = Buffer.from(signature, 'hex');
  if (hashBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(hashBuf, sigBuf);
}

/**
 * Verify Zoho Billing webhook signature using timing-safe comparison.
 */
export function verifyZohoWebhook(signature: string, body: string): boolean {
  const webhookSecret = process.env.ZOHO_BILLING_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  const hash = createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const sigBuf = Buffer.from(signature, 'hex');
  if (hashBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(hashBuf, sigBuf);
}

// ============================================
// WEBHOOK PAYLOAD PARSING
// ============================================

interface ParsedWebhook {
  valid: boolean;
  event?: string;
  data?: Record<string, unknown>;
}

/**
 * Parse and verify a webhook payload from any supported provider.
 */
export function parseWebhookPayload(
  provider: string,
  body: string,
  signature: string
): ParsedWebhook {
  let valid = false;

  switch (provider) {
    case 'paystack':
      valid = verifyPaystackWebhook(signature, body);
      break;
    case 'lemonsqueezy':
      valid = verifyLemonSqueezyWebhook(signature, body);
      break;
    case 'zoho':
      valid = verifyZohoWebhook(signature, body);
      break;
    default:
      valid = false;
  }

  if (!valid) return { valid: false };

  try {
    const parsed = JSON.parse(body);
    return {
      valid: true,
      event: parsed.event || parsed.type || parsed.data?.event,
      data: parsed.data || parsed,
    };
  } catch {
    return { valid: false };
  }
}

// ============================================
// PAYMENT VERIFICATION
// ============================================

interface PaymentVerificationResult {
  success: boolean;
  amount: number;
  currency: string;
  reference?: string;
}

/**
 * Verify a payment with the provider's API.
 */
export async function verifyPayment(
  provider: string,
  reference: string
): Promise<PaymentVerificationResult> {
  switch (provider) {
    case 'paystack':
      return verifyPaystackPayment(reference);
    case 'lemonsqueezy':
      return verifyLemonSqueezyPayment(reference);
    case 'stripe':
      return verifyStripePayment(reference);
    case 'zoho':
      return verifyZohoPayment(reference);
    default:
      return { success: false, amount: 0, currency: 'USD' };
  }
}

async function verifyPaystackPayment(reference: string): Promise<PaymentVerificationResult> {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const data = await response.json();
  if (!data.status || data.data?.status !== 'success') {
    return { success: false, amount: 0, currency: 'USD' };
  }
  return {
    success: true,
    amount: data.data.amount / 100,
    currency: data.data.currency,
    reference: data.data.reference,
  };
}

async function verifyLemonSqueezyPayment(orderId: string): Promise<PaymentVerificationResult> {
  const response = await fetch(`https://api.lemonsqueezy.com/v1/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}` },
  });
  const data = await response.json();
  const order = data.data?.attributes;
  if (!order || order.status !== 'paid') {
    return { success: false, amount: 0, currency: 'USD' };
  }
  return {
    success: true,
    amount: parseFloat(order.total) || 0,
    currency: order.currency_code || 'USD',
    reference: orderId,
  };
}

async function verifyStripePayment(sessionId: string): Promise<PaymentVerificationResult> {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  const data = await response.json();
  if (data.payment_status !== 'paid') {
    return { success: false, amount: 0, currency: 'USD' };
  }
  return {
    success: true,
    amount: data.amount_total / 100,
    currency: data.currency?.toUpperCase() || 'USD',
    reference: sessionId,
  };
}

async function verifyZohoPayment(reference: string): Promise<PaymentVerificationResult> {
  // Zoho verification via API
  const response = await fetch(
    `https://billing.zoho.com/api/v3/transactions/${reference}`,
    {
      headers: {
        'Authorization': `Zoho-authtoken ${process.env.ZOHO_BILLING_AUTH_TOKEN}`,
      },
    }
  );
  const data = await response.json();
  const transaction = data.transaction;
  if (!transaction || transaction.status !== 'success') {
    return { success: false, amount: 0, currency: 'USD' };
  }
  return {
    success: true,
    amount: parseFloat(transaction.amount) || 0,
    currency: transaction.currency_code || 'USD',
    reference,
  };
}
