// Payment Service for Pitch Perfect × Automagikal
// Supports: Paystack (South Africa), Stripe (International), Zoho Billing (Enterprise), LemonSqueezy (Merchant of Record)

// ============================================
// TYPE DEFINITIONS
// ============================================

export type PaymentGateway = 'paystack' | 'stripe' | 'zoho' | 'lemonsqueezy';
export type Currency = 'ZAR' | 'USD' | 'EUR' | 'GBP';

export interface PaymentCustomer {
  email: string;
  name: string;
  country: string;
  companyId?: string;
}

export interface PaymentProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: Currency;
  modules: Array<{
    id: string;
    name: string;
    cycles: number;
  }>;
}

export interface PaymentSession {
  id: string;
  gateway: PaymentGateway;
  checkoutUrl: string;
  amount: number;
  currency: Currency;
  customerEmail: string;
  productId: string;
  metadata: Record<string, unknown>;
  expiresAt: Date;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  gateway: PaymentGateway;
  amount: number;
  currency: Currency;
  customerEmail: string;
  productId: string;
  metadata: Record<string, unknown>;
  processedAt: Date;
}

export interface EntitlementCreation {
  userId: string;
  productId: string;
  modules: Array<{
    moduleId: string;
    totalCycles: number;
    usedCycles: number;
  }>;
}

// ============================================
// PRODUCT CONFIGURATION
// ============================================

export const PRODUCTS: Record<string, PaymentProduct> = {
  'pitch-deck': {
    id: 'prod_pitch_deck',
    name: 'Pitch Deck Analyser',
    description: 'Get your deck scored against the 10-slide framework with visual design audit.',
    price: 15,
    currency: 'USD',
    modules: [
      { id: 'm1', name: 'Deck Analysis', cycles: 2 },
    ],
  },
  'elevator-script': {
    id: 'prod_elevator_script',
    name: 'Elevator Pitch Script Check',
    description: 'Submit your script for element-by-element feedback and rewrite suggestions.',
    price: 10,
    currency: 'USD',
    modules: [
      { id: 'm2', name: 'Script Coaching', cycles: 2 },
    ],
  },
  'elevator-live': {
    id: 'prod_elevator_live',
    name: 'Elevator Pitch Live',
    description: 'Script coaching plus live recording practice with delivery feedback.',
    price: 25,
    currency: 'USD',
    modules: [
      { id: 'm2', name: 'Script Coaching', cycles: 2 },
      { id: 'm3', name: 'Live Recording', cycles: 3 },
    ],
  },
  'pitch-deck-live': {
    id: 'prod_pitch_deck_live',
    name: 'Pitch Deck Live',
    description: 'Deck analysis plus full 30-minute presentation recording and coaching.',
    price: 40,
    currency: 'USD',
    modules: [
      { id: 'm1', name: 'Deck Analysis', cycles: 2 },
      { id: 'm4', name: 'Full Pitch Session', cycles: 3 },
    ],
  },
  'master': {
    id: 'prod_master',
    name: 'Master Pitch Analyser',
    description: 'Complete coaching: deck, script, live delivery, and full presentation.',
    price: 60,
    currency: 'USD',
    modules: [
      { id: 'm1', name: 'Deck Analysis', cycles: 2 },
      { id: 'm2', name: 'Script Coaching', cycles: 2 },
    ],
  },
};

// South African pricing (in ZAR)
export const SA_PRICING: Record<string, number> = {
  'pitch-deck': 275,      // ~$15
  'elevator-script': 185, // ~$10
  'elevator-live': 460,   // ~$25
  'pitch-deck-live': 735, // ~$40
  'master': 1100,         // ~$60
};

// Countries that use Paystack (South Africa focus)
const PAYSTACK_COUNTRIES = ['ZA', 'ZAF', 'South Africa'];

// Countries where Zoho Billing is preferred (enterprise customers)
const ZOHO_BILLING_COUNTRIES = ['IN', 'IND', 'India']; // Zoho's primary market

// Stripe price IDs (configured in Stripe Dashboard) — env vars per product
const STRIPE_PRICE_IDS: Record<string, string | undefined> = {
  'pitch-deck': process.env.STRIPE_PRICE_PITCH_DECK,
  'elevator-script': process.env.STRIPE_PRICE_ELEVATOR_SCRIPT,
  'elevator-live': process.env.STRIPE_PRICE_ELEVATOR_LIVE,
  'pitch-deck-live': process.env.STRIPE_PRICE_PITCH_DECK_LIVE,
  'master': process.env.STRIPE_PRICE_MASTER,
};

// Zoho Billing plan codes (configured in Zoho Billing)
const ZOHO_PLAN_CODES: Record<string, string | undefined> = {
  'pitch-deck': process.env.ZOHO_PLAN_PITCH_DECK,
  'elevator-script': process.env.ZOHO_PLAN_ELEVATOR_SCRIPT,
  'elevator-live': process.env.ZOHO_PLAN_ELEVATOR_LIVE,
  'pitch-deck-live': process.env.ZOHO_PLAN_PITCH_DECK_LIVE,
  'master': process.env.ZOHO_PLAN_MASTER,
};

// ============================================
// GATEWAY ROUTING
// ============================================

/**
 * Payment Gateway Routing Logic:
 * - South Africa → Paystack (ZAR, local payment methods)
 * - India → Zoho Billing (Zoho's strongest market)
 * - Rest of World → Stripe (cards, Apple Pay, Google Pay)
 * - Fallback → LemonSqueezy (Merchant of Record, handles tax compliance)
 * 
 * Override: If query param `gateway` is explicitly set, use that.
 */
export function determinePaymentGateway(country: string, explicitGateway?: string): PaymentGateway {
  // Allow explicit gateway override (e.g., from frontend)
  if (explicitGateway && ['paystack', 'stripe', 'zoho', 'lemonsqueezy'].includes(explicitGateway)) {
    return explicitGateway as PaymentGateway;
  }

  const normalizedCountry = country.toUpperCase();

  // South Africa uses Paystack
  if (PAYSTACK_COUNTRIES.includes(normalizedCountry) || normalizedCountry === 'SOUTH AFRICA') {
    return 'paystack';
  }

  // India / Zoho-preferring markets use Zoho Billing
  if (ZOHO_BILLING_COUNTRIES.includes(normalizedCountry)) {
    return 'zoho';
  }

  // All other countries use Stripe (international card payments)
  // LemonSqueezy is available as fallback if Stripe is not configured
  if (process.env.STRIPE_SECRET_KEY) {
    return 'stripe';
  }

  return 'lemonsqueezy';
}

export function getCurrencyForCountry(country: string): Currency {
  const gateway = determinePaymentGateway(country);

  switch (gateway) {
    case 'paystack':
      return 'ZAR';
    case 'zoho':
      return 'USD'; // Zoho Billing supports multi-currency, default USD
    default:
      return 'USD';
  }
}

export function getPriceForCountry(productId: string, country: string): { amount: number; currency: Currency } {
  const gateway = determinePaymentGateway(country);

  if (gateway === 'paystack') {
    return {
      amount: SA_PRICING[productId] || PRODUCTS[productId]?.price * 18 || 0,
      currency: 'ZAR',
    };
  }

  return {
    amount: PRODUCTS[productId]?.price || 0,
    currency: 'USD',
  };
}

// ============================================
// PAYSTACK INTEGRATION (South Africa)
// ============================================

async function createPaystackSession(
  customer: PaymentCustomer,
  productId: string,
  metadata: Record<string, unknown>
): Promise<PaymentSession> {
  const product = PRODUCTS[productId];
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }
  
  const { amount, currency } = getPriceForCountry(productId, customer.country);
  
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
    body: JSON.stringify({
      email: customer.email,
      amount: amount * 100, // Paystack expects amount in cents
      currency: currency,
      reference: `PP-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback`,
      metadata: {
        product_id: productId,
        customer_name: customer.name,
        customer_country: customer.country,
        company_id: customer.companyId,
        ...metadata,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    id: data.data.reference,
    gateway: 'paystack',
    checkoutUrl: data.data.authorization_url,
    amount,
    currency,
    customerEmail: customer.email,
    productId,
    metadata,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  };
}

async function verifyPaystackPayment(reference: string): Promise<PaymentResult> {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Paystack verification failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.data.status !== 'success') {
    return {
      success: false,
      transactionId: reference,
      gateway: 'paystack',
      amount: data.data.amount / 100,
      currency: data.data.currency,
      customerEmail: data.data.customer.email,
      productId: data.data.metadata.product_id,
      metadata: data.data.metadata,
      processedAt: new Date(),
    };
  }
  
  return {
    success: true,
    transactionId: reference,
    gateway: 'paystack',
    amount: data.data.amount / 100,
    currency: data.data.currency,
    customerEmail: data.data.customer.email,
    productId: data.data.metadata.product_id,
    metadata: data.data.metadata,
    processedAt: new Date(data.data.paid_at),
  };
}

// ============================================
// LEMONSQUEEZY INTEGRATION (Merchant of Record)
// ============================================

async function createLemonSqueezySession(
  customer: PaymentCustomer,
  productId: string,
  metadata: Record<string, unknown>
): Promise<PaymentSession> {
  const product = PRODUCTS[productId];
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }
  
  const { amount, currency } = getPriceForCountry(productId, customer.country);
  
  // Find the variant ID for this product (configured in LemonSqueezy dashboard)
  const variantId = process.env[`LEMONSQUEEZY_VARIANT_${productId.toUpperCase().replace(/-/g, '_')}`];
  
  if (!variantId) {
    throw new Error(`LemonSqueezy variant not configured for product: ${productId}`);
  }
  
  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: customer.email,
            name: customer.name,
            custom: {
              product_id: productId,
              customer_country: customer.country,
              company_id: customer.companyId,
              ...metadata,
            },
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
            desc: true,
            discount: true,
            dark: false,
            subscription_preview: true,
          },
          product_options: {
            name: product.name,
            description: product.description,
            enabled_variants: [variantId],
          },
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: process.env.LEMONSQUEEZY_STORE_ID,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId,
            },
          },
        },
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LemonSqueezy error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  return {
    id: data.data.id,
    gateway: 'lemonsqueezy',
    checkoutUrl: data.data.attributes.url,
    amount,
    currency,
    customerEmail: customer.email,
    productId,
    metadata,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };
}

async function verifyLemonSqueezyPayment(orderId: string): Promise<PaymentResult> {
  const response = await fetch(`https://api.lemonsqueezy.com/v1/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`LemonSqueezy verification failed: ${response.status}`);
  }
  
  const data = await response.json();
  const order = data.data;
  
  const status = order.attributes.status;
  const success = status === 'paid' || status === 'refunded';
  
  return {
    success,
    transactionId: order.id,
    gateway: 'lemonsqueezy',
    amount: order.attributes.total / 100,
    currency: order.attributes.currency.toUpperCase(),
    customerEmail: order.attributes.user_email,
    productId: order.attributes.first_order_item?.product_name || order.attributes.custom_data?.product_id,
    metadata: order.attributes.custom_data || {},
    processedAt: new Date(order.attributes.created_at),
  };
}

// ============================================
// STRIPE INTEGRATION (International)
// ============================================

async function createStripeSession(
  customer: PaymentCustomer,
  productId: string,
  metadata: Record<string, unknown>
): Promise<PaymentSession> {
  const product = PRODUCTS[productId];
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const priceId = STRIPE_PRICE_IDS[productId];
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for product: ${productId}. Set env var STRIPE_PRICE_${productId.toUpperCase().replace(/-/g, '_')}`);
  }

  // Use Stripe Checkout Sessions API
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    },
    body: new URLSearchParams({
      mode: 'payment',
      payment_method_types: 'card',
      line_items: `price:${priceId},quantity:1`,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`,
      customer_email: customer.email,
      metadata: JSON.stringify({
        product_id: productId,
        customer_name: customer.name,
        customer_country: customer.country,
        company_id: customer.companyId,
        ...metadata,
      }),
      // Allow Apple Pay and Google Pay
      payment_method_types: 'card,apple_pay,google_pay',
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stripe error: ${response.status} - ${error}`);
  }

  const session = await response.json();

  return {
    id: session.id,
    gateway: 'stripe',
    checkoutUrl: session.url,
    amount: session.amount_total / 100,
    currency: session.currency.toUpperCase() as Currency,
    customerEmail: customer.email,
    productId,
    metadata,
    expiresAt: new Date(session.expires_at * 1000),
  };
}

async function verifyStripePayment(sessionId: string): Promise<PaymentResult> {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Stripe verification failed: ${response.status}`);
  }

  const session = await response.json();

  return {
    success: session.payment_status === 'paid',
    transactionId: session.payment_intent || session.id,
    gateway: 'stripe',
    amount: session.amount_total / 100,
    currency: session.currency.toUpperCase() as Currency,
    customerEmail: session.customer_details?.email || session.customer_email,
    productId: session.metadata?.product_id || '',
    metadata: session.metadata || {},
    processedAt: new Date(),
  };
}

// ============================================
// ZOHO BILLING INTEGRATION (Enterprise)
// ============================================

async function createZohoBillingSession(
  customer: PaymentCustomer,
  productId: string,
  metadata: Record<string, unknown>
): Promise<PaymentSession> {
  const product = PRODUCTS[productId];
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const planCode = ZOHO_PLAN_CODES[productId];
  if (!planCode) {
    throw new Error(`Zoho Billing plan not configured for product: ${productId}. Set env var ZOHO_PLAN_${productId.toUpperCase().replace(/-/g, '_')}`);
  }

  const zohoOrgId = process.env.ZOHO_BILLING_ORG_ID;
  if (!zohoOrgId) {
    throw new Error('ZOHO_BILLING_ORG_ID environment variable is required');
  }

  // Step 1: Create or retrieve Zoho Billing customer
  const customerPayload = {
    name: customer.name,
    email: customer.email,
    company_name: customer.companyId || customer.name,
  country: customer.country,
  custom_fields: Object.entries(metadata).map(([key, value]) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: String(value),
    })),
  };

  const customerResponse = await fetch(`https://billing.zoho.com/api/v3/customers?organization_id=${zohoOrgId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Zoho-authtoken ${process.env.ZOHO_BILLING_AUTH_TOKEN}`,
    },
    body: JSON.stringify(customerPayload),
  });

  let zohoCustomerId: string;
  if (customerResponse.ok) {
    const customerData = await customerResponse.json();
    zohoCustomerId = customerData.customer?.customer_id || '';
  } else {
    // Try to find existing customer by email
    const findResponse = await fetch(
      `https://billing.zoho.com/api/v3/customers?email=${customer.email}&organization_id=${zohoOrgId}`,
      {
        headers: { 'Authorization': `Zoho-authtoken ${process.env.ZOHO_BILLING_AUTH_TOKEN}` },
      }
    );
    if (findResponse.ok) {
      const findData = await findResponse.json();
      zohoCustomerId = findData.customers?.[0]?.customer_id || '';
    }
  }

  if (!zohoCustomerId) {
    throw new Error('Failed to create or find Zoho Billing customer');
  }

  // Step 2: Create a hosted checkout page
  const checkoutPayload = {
    customer_id: zohoCustomerId,
    plan_code: planCode,
    reference_id: `PP-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
    custom_fields: Object.entries(metadata).map(([key, value]) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: String(value),
    })),
  };

  const checkoutResponse = await fetch(
    `https://billing.zoho.com/api/v3/hostedpages/new?organization_id=${zohoOrgId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Zoho-authtoken ${process.env.ZOHO_BILLING_AUTH_TOKEN}`,
      },
      body: JSON.stringify(checkoutPayload),
    }
  );

  if (!checkoutResponse.ok) {
    const error = await checkoutResponse.text();
    throw new Error(`Zoho Billing error: ${checkoutResponse.status} - ${error}`);
  }

  const checkoutData = await checkoutResponse.json();

  return {
    id: checkoutData.hostedpage?.hostedpage_id || checkoutPayload.reference_id,
    gateway: 'zoho',
    checkoutUrl: checkoutData.hostedpage?.url || '',
    amount: product.price,
    currency: product.currency,
    customerEmail: customer.email,
    productId,
    metadata: { ...metadata, zohoCustomerId, zohoOrgId },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };
}

async function verifyZohoBillingPayment(hostedPageId: string): Promise<PaymentResult> {
  const zohoOrgId = process.env.ZOHO_BILLING_ORG_ID;

  const response = await fetch(
    `https://billing.zoho.com/api/v3/hostedpages/${hostedPageId}?organization_id=${zohoOrgId}`,
    {
      headers: { 'Authorization': `Zoho-authtoken ${process.env.ZOHO_BILLING_AUTH_TOKEN}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Zoho Billing verification failed: ${response.status}`);
  }

  const data = await response.json();
  const hostedPage = data.hostedpage || {};

  return {
    success: hostedPage.status === 'success' || hostedPage.status === 'completed',
    transactionId: hostedPage.reference_id || hostedPageId,
    gateway: 'zoho',
    amount: hostedPage.amount_paid || 0,
    currency: 'USD',
    customerEmail: '', // Fetched from subscription details
    productId: '',
    metadata: { zohoSubscriptionId: hostedPage.subscription_id },
    processedAt: new Date(),
  };
}

// ============================================
// UNIFIED PAYMENT INTERFACE
// ============================================

export async function createCheckoutSession(
  customer: PaymentCustomer,
  productId: string,
  metadata: Record<string, unknown> = {},
  explicitGateway?: string
): Promise<PaymentSession> {
  const gateway = determinePaymentGateway(customer.country, explicitGateway);

  switch (gateway) {
    case 'paystack':
      return createPaystackSession(customer, productId, metadata);
    case 'stripe':
      return createStripeSession(customer, productId, metadata);
    case 'zoho':
      return createZohoBillingSession(customer, productId, metadata);
    case 'lemonsqueezy':
      return createLemonSqueezySession(customer, productId, metadata);
    default:
      throw new Error(`Unknown payment gateway: ${gateway}`);
  }
}

export async function verifyPayment(
  gateway: PaymentGateway,
  reference: string
): Promise<PaymentResult> {
  switch (gateway) {
    case 'paystack':
      return verifyPaystackPayment(reference);
    case 'stripe':
      return verifyStripePayment(reference);
    case 'zoho':
      return verifyZohoBillingPayment(reference);
    case 'lemonsqueezy':
      return verifyLemonSqueezyPayment(reference);
    default:
      throw new Error(`Unknown payment gateway: ${gateway}`);
  }
}

// ============================================
// WEBHOOK HANDLING
// ============================================

export interface WebhookPayload {
  gateway: PaymentGateway;
  event: string;
  data: Record<string, unknown>;
  signature: string;
  rawBody: string;
}

export function verifyPaystackWebhook(signature: string, body: string): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex');
  
  return hash === signature;
}

export function verifyLemonSqueezyWebhook(signature: string, body: string): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '')
    .update(body)
    .digest('hex');
  
  return signature === hash;
}

export function verifyStripeWebhook(signature: string, body: string): boolean {
  const crypto = require('crypto');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  // Stripe signatures are in format: t=timestamp,v1=signature
  const sigParts = signature.split(',');
  const v1Part = sigParts.find(s => s.startsWith('v1='));
  return v1Part ? v1Part.replace('v1=', '') === expectedSig : false;
}

export function verifyZohoWebhook(signature: string, body: string): boolean {
  const crypto = require('crypto');
  const webhookSecret = process.env.ZOHO_BILLING_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  return hash === signature;
}

export function parseWebhookPayload(
  gateway: PaymentGateway,
  body: string,
  signature: string
): { valid: boolean; event?: string; data?: Record<string, unknown> } {
  try {
    const parsed = JSON.parse(body);

    switch (gateway) {
      case 'paystack': {
        const valid = verifyPaystackWebhook(signature, body);
        return { valid, event: parsed.event, data: parsed.data };
      }
      case 'stripe': {
        const valid = verifyStripeWebhook(signature, body);
        return { valid, event: parsed.type, data: parsed.data };
      }
      case 'zoho': {
        const valid = verifyZohoWebhook(signature, body);
        return { valid, event: parsed.event_type || parsed.event, data: parsed.data };
      }
      case 'lemonsqueezy': {
        const valid = verifyLemonSqueezyWebhook(signature, body);
        return {
          valid,
          event: parsed.meta?.event_name || parsed.event,
          data: parsed.data,
        };
      }
      default:
        return { valid: false };
    }
  } catch (e) {
    return { valid: false };
  }
}

// ============================================
// ENTITLEMENT CREATION
// ============================================

export function createEntitlementsFromPayment(
  payment: PaymentResult,
  userId: string
): EntitlementCreation {
  const product = PRODUCTS[payment.productId];
  
  if (!product) {
    throw new Error(`Product not found: ${payment.productId}`);
  }
  
  return {
    userId,
    productId: payment.productId,
    modules: product.modules.map(m => ({
      moduleId: m.id,
      totalCycles: m.cycles,
      usedCycles: 0,
    })),
  };
}
