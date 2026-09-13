// Payment Service
// Handles payment gateway routing, webhook verification, and checkout session creation
// Supports: Paystack (African Markets), Stripe (International/Fallback)

import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

// ============================================
// PRODUCT DEFINITIONS
// ============================================

export const PRODUCTS: Record<string, { name: string; description: string }> = {
  'pitch-deck': { name: 'Pitch Deck Analyzer', description: 'AI-powered pitch deck analysis' },
  'elevator-script': { name: 'Script Check', description: 'Script analysis and improvement' },
  'elevator-live': { name: 'Live Pitch', description: 'Video delivery analysis' },
  'pitch-deck-live': { name: 'Pitch Deck + Live Bundle', description: 'Combined deck and video analysis' },
  'master': { name: 'Master Plan', description: 'Full access to all modules' },
  'founder': { name: 'Founder Coaching', description: 'Investor readiness, pathway, and network profiling' },
  'founder-readiness': { name: 'Founder Readiness', description: 'Investor readiness assessment' },
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
    'founder': 'PROFESSIONAL',
    'founder-readiness': 'PROFESSIONAL',
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
    'founder': 10,
    'founder-readiness': 3,
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
 * Paystack → African countries, Stripe → International/Fallback
 */
export function determinePaymentGateway(country: string): string {
  const code = country?.toUpperCase?.() || 'US';
  if (AFRICAN_COUNTRIES_PAYSTACK.includes(code)) return 'paystack';
  if (process.env.STRIPE_SECRET_KEY) return 'stripe';
  return 'stripe'; // Default fallback
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
    'founder': 79,
    'founder-readiness': 39,
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
    case 'stripe':
      return createStripeSession(customer, productId, metadata);
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

// (Zoho Billing session creation removed — not used for this service)

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
    'founder': process.env.STRIPE_PRICE_FOUNDER || '',
    'founder-readiness': process.env.STRIPE_PRICE_FOUNDER_READINESS || '',
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

// (Zoho Billing webhook verification removed — not used for this service)

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
    case 'stripe':
      return verifyStripePayment(reference);
    default:
      return { success: false, amount: 0, currency: 'USD' };
  }
}

async function verifyPaystackPayment(reference: string): Promise<PaymentVerificationResult> {
  // SSRF fix: validate reference is a safe path segment (alphanumeric + hyphens/underscores only).
  // Prevents path traversal (../) and URL injection that could redirect the fetch.
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(reference)) {
    return { success: false, amount: 0, currency: 'USD' };
  }
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
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

async function verifyStripePayment(sessionId: string): Promise<PaymentVerificationResult> {
  // SSRF fix: validate sessionId is a safe path segment (alphanumeric + hyphens only).
  // Stripe session IDs look like "cs_test_a1b2c3..." or "cs_live_x9y8z7...".
  // Prevents path traversal and URL injection.
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(sessionId)) {
    return { success: false, amount: 0, currency: 'USD' };
  }
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
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

// (Zoho Billing payment verification removed — not used for this service)
