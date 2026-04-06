// Zoho Billing Integration Service for Pitch Perfect × Automagikal
// Handles subscription management, plan creation, invoicing, and customer portal

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Billing interval for subscription plans */
export type BillingInterval = 'days' | 'weeks' | 'months' | 'years';

/** Subscription status returned from Zoho Billing */
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trial' | 'paused' | 'non_renewing';

/** Subscription plan configuration */
export interface PlanConfig {
  name: string;
  productCode: string;
  price: number;
  currencyCode?: string;
  interval: BillingInterval;
  intervalCount?: number;
  trialDays?: number;
  description?: string;
}

/** Subscription details */
export interface Subscription {
  subscriptionId: string;
  customerId: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  currentTermStart: string;
  currentTermEnd: string;
  nextBillingAt?: string;
  amount: number;
  currencyCode: string;
}

/** Customer record in Zoho Billing */
export interface BillingCustomer {
  customerId: string;
  displayName: string;
  email: string;
  company?: string;
  currencyCode?: string;
  createdAt: string;
}

/** Invoice details */
export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  subscriptionId: string;
  customerId: string;
  status: 'paid' | 'unpaid' | 'void' | 'partial';
  amount: number;
  currencyCode: string;
  date: string;
  dueDate: string;
}

// ============================================
// ZOHO BILLING API CONFIGURATION
// ============================================

const ZOHO_BILLING_CONFIG = {
  clientId: process.env.ZOHO_BILLING_CLIENT_ID,
  clientSecret: process.env.ZOHO_BILLING_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_BILLING_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_BILLING_API_DOMAIN || 'https://www.zohoapis.com/billing/v1',
  orgId: process.env.ZOHO_BILLING_ORG_ID,
};

// Token cache — independent from other Zoho services
let billingTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  if (billingTokenCache && billingTokenCache.expiresAt > Date.now()) {
    return billingTokenCache.token;
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_BILLING_CONFIG.clientId!,
      client_secret: ZOHO_BILLING_CONFIG.clientSecret!,
      refresh_token: ZOHO_BILLING_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho Billing auth failed: ${response.status}`);
  }

  const data = await response.json();
  billingTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function billingRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_BILLING_CONFIG.apiDomain}${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${token}`,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  if (ZOHO_BILLING_CONFIG.orgId) {
    headers['X-com-zoho-organization-id'] = ZOHO_BILLING_CONFIG.orgId;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho Billing API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ============================================
// PLAN MANAGEMENT
// ============================================

/**
 * Create a new subscription plan in Zoho Billing.
 * @param name - Human-readable plan name (e.g. "Pitch Perfect Pro Monthly")
 * @param price - Recurring price per billing interval
 * @param interval - Billing cadence (days, weeks, months, years)
 * @param trialDays - Optional free-trial period before first charge
 */
export async function createPlan(
  name: string,
  price: number,
  interval: BillingInterval,
  trialDays?: number,
): Promise<{ planCode: string }> {
  const result = await billingRequest('/plans', 'POST', {
    name,
    recurring_price: price,
    interval,
    interval_count: 1,
    trial_days: trialDays || 0,
    currency_code: 'USD',
  }) as { plan: { plan_code: string } };

  return { planCode: result.plan.plan_code };
}

/**
 * List all subscription plans configured in Zoho Billing.
 * @returns Array of plan objects with metadata
 */
export async function listPlans(): Promise<unknown[]> {
  const result = await billingRequest('/plans') as {
    plans: unknown[];
  };
  return result.plans || [];
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

/**
 * Create a new billing customer.
 * @param email - Customer email address
 * @param name - Display name for the customer
 */
export async function createCustomer(
  email: string,
  name: string,
): Promise<{ customerId: string }> {
  const result = await billingRequest('/customers', 'POST', {
    display_name: name,
    email,
    currency_code: 'USD',
  }) as { customer: { customer_id: string } };

  return { customerId: result.customer.customer_id };
}

/**
 * Retrieve customer details by ID.
 * @param customerId - Zoho Billing customer identifier
 */
export async function getCustomer(customerId: string): Promise<BillingCustomer> {
  const result = await billingRequest(`/customers/${customerId}`) as {
    customer: BillingCustomer;
  };
  return result.customer;
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Create a new subscription for a customer on a given plan.
 * @param customerId - The billing customer to subscribe
 * @param planCode - The plan to assign (from createPlan or listPlans)
 */
export async function createSubscription(
  customerId: string,
  planCode: string,
): Promise<{ subscriptionId: string }> {
  const result = await billingRequest('/subscriptions', 'POST', {
    customer_id: customerId,
    plan_code: planCode,
    auto_collect: true,
  }) as { subscription: { subscription_id: string } };

  return { subscriptionId: result.subscription.subscription_id };
}

/**
 * Upgrade or downgrade an existing subscription to a different plan.
 * @param subscriptionId - The active subscription to modify
 * @param planCode - The new plan to switch to
 */
export async function updateSubscription(
  subscriptionId: string,
  planCode: string,
): Promise<void> {
  await billingRequest(`/subscriptions/${subscriptionId}`, 'POST', {
    plan_code: planCode,
  });
}

/**
 * Cancel a subscription. The customer retains access until the end of the current billing period.
 * @param subscriptionId - The subscription to cancel
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await billingRequest(`/subscriptions/${subscriptionId}/cancel`, 'POST', {
    cancel_at_end: true,
  });
}

/**
 * Retrieve full subscription details.
 * @param subscriptionId - Zoho Billing subscription identifier
 */
export async function getSubscription(subscriptionId: string): Promise<Subscription> {
  const result = await billingRequest(`/subscriptions/${subscriptionId}`) as {
    subscription: Subscription;
  };
  return result.subscription;
}

// ============================================
// INVOICE MANAGEMENT
// ============================================

/**
 * Generate a new invoice for a given subscription.
 * Useful for manual invoicing or ad-hoc charges.
 * @param subscriptionId - The subscription to invoice
 */
export async function generateInvoice(
  subscriptionId: string,
): Promise<{ invoiceId: string }> {
  const result = await billingRequest(
    `/subscriptions/${subscriptionId}/invoices`,
    'POST',
    {},
  ) as { invoice: { invoice_id: string } };

  return { invoiceId: result.invoice.invoice_id };
}
