// Payment Service for Pitch Perfect
// Supports: Paystack (South Africa), LemonSqueezy (Merchant of Record - International)

// ============================================
// TYPE DEFINITIONS
// ============================================

export type PaymentGateway = 'paystack' | 'lemonsqueezy';
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

// ============================================
// GATEWAY ROUTING
// ============================================

export function determinePaymentGateway(country: string): PaymentGateway {
  const normalizedCountry = country.toUpperCase();
  
  // South Africa uses Paystack
  if (PAYSTACK_COUNTRIES.includes(normalizedCountry) || normalizedCountry === 'SOUTH AFRICA') {
    return 'paystack';
  }
  
  // All other countries use LemonSqueezy (Merchant of Record)
  return 'lemonsqueezy';
}

export function getCurrencyForCountry(country: string): Currency {
  const gateway = determinePaymentGateway(country);
  
  if (gateway === 'paystack') {
    return 'ZAR';
  }
  
  return 'USD';
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
// UNIFIED PAYMENT INTERFACE
// ============================================

export async function createCheckoutSession(
  customer: PaymentCustomer,
  productId: string,
  metadata: Record<string, unknown> = {}
): Promise<PaymentSession> {
  const gateway = determinePaymentGateway(customer.country);
  
  if (gateway === 'paystack') {
    return createPaystackSession(customer, productId, metadata);
  } else {
    return createLemonSqueezySession(customer, productId, metadata);
  }
}

export async function verifyPayment(
  gateway: PaymentGateway,
  reference: string
): Promise<PaymentResult> {
  if (gateway === 'paystack') {
    return verifyPaystackPayment(reference);
  } else {
    return verifyLemonSqueezyPayment(reference);
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

export function parseWebhookPayload(
  gateway: PaymentGateway,
  body: string,
  signature: string
): { valid: boolean; event?: string; data?: Record<string, unknown> } {
  try {
    const parsed = JSON.parse(body);
    
    if (gateway === 'paystack') {
      const valid = verifyPaystackWebhook(signature, body);
      return {
        valid,
        event: parsed.event,
        data: parsed.data,
      };
    } else if (gateway === 'lemonsqueezy') {
      const valid = verifyLemonSqueezyWebhook(signature, body);
      return {
        valid,
        event: parsed.meta?.event_name || parsed.event,
        data: parsed.data,
      };
    }
    
    return { valid: false };
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
