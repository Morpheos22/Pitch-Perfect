// Zoho CRM Integration Service for Pitch Perfect
// Handles lead management, contact sync, and entitlement tracking

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ZohoLead {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  country?: string;
  phone?: string;
  leadSource?: string;
  leadStatus?: 'New' | 'Contacted' | 'Qualified' | 'Unqualified';
  description?: string;
  // Custom fields
  Product_Purchased?: string;
  Total_Sessions_Used?: number;
  Last_Session_Date?: string;
  Last_Session_Score?: number;
  Customer_Type?: 'Free' | 'Paid' | 'Gifted';
}

export interface ZohoContact extends ZohoLead {
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  mailingCountry?: string;
}

export interface ZohoDeal {
  id?: string;
  dealName: string;
  stage: 'Qualification' | 'Needs Analysis' | 'Value Proposition' | 'Negotiation' | 'Closed Won' | 'Closed Lost';
  amount: number;
  currency: string;
  contactId?: string;
  leadId?: string;
  closingDate: string;
  type: 'New Business' | 'Existing Business' | 'Add-on';
  productName: string;
  description?: string;
}

export interface ZohoSessionRecord {
  userId: string;
  sessionId: string;
  sessionType: 'deck' | 'script' | 'live' | 'full';
  productModule: string;
  score: number;
  duration?: number;
  completedAt: Date;
}

// ============================================
// ZOHO API CONFIGURATION
// ============================================

const ZOHO_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com',
  orgId: process.env.ZOHO_ORG_ID,
};

// Token cache
let accessTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  // Check cache
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  const response = await fetch(`https://accounts.zoho.com/oauth/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CONFIG.clientId!,
      client_secret: ZOHO_CONFIG.clientSecret!,
      refresh_token: ZOHO_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho auth failed: ${response.status}`);
  }

  const data = await response.json();
  
  // Cache for 55 minutes (tokens expire in 1 hour)
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  return data.access_token;
}

async function zohoApiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object
): Promise<unknown> {
  const token = await getAccessToken();
  
  const response = await fetch(`${ZOHO_CONFIG.apiDomain}/crm/v2${endpoint}`, {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoho API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ============================================
// LEAD MANAGEMENT
// ============================================

export async function createOrUpdateLead(lead: ZohoLead): Promise<{ id: string; created: boolean }> {
  // First, search for existing lead by email
  const existingLeads = await zohoApiRequest(
    `/Leads/search?email=${encodeURIComponent(lead.email)}`
  ) as { data?: Array<{ id: string }> };

  if (existingLeads.data && existingLeads.data.length > 0) {
    // Update existing lead
    const leadId = existingLeads.data[0].id;
    await zohoApiRequest(`/Leads/${leadId}`, 'PUT', {
      data: [lead],
    });
    return { id: leadId, created: false };
  }

  // Create new lead
  const result = await zohoApiRequest('/Leads', 'POST', {
    data: [lead],
  }) as { data: Array<{ details: { id: string } }> };

  return { id: result.data[0].details.id, created: true };
}

export async function updateLeadStatus(leadId: string, status: ZohoLead['leadStatus']): Promise<void> {
  await zohoApiRequest(`/Leads/${leadId}`, 'PUT', {
    data: [{ Lead_Status: status }],
  });
}

export async function convertLeadToContact(leadId: string): Promise<{ contactId: string }> {
  const result = await zohoApiRequest(`/Leads/${leadId}/actions/convert`, 'POST', {
    data: [{
      convert_to: ['Contacts'],
    }],
  }) as { Contacts: string };

  return { contactId: result.Contacts };
}

// ============================================
// CONTACT MANAGEMENT
// ============================================

export async function getContactByEmail(email: string): Promise<ZohoContact | null> {
  try {
    const result = await zohoApiRequest(
      `/Contacts/search?email=${encodeURIComponent(email)}`
    ) as { data?: ZohoContact[] };

    return result.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function updateContact(contactId: string, data: Partial<ZohoContact>): Promise<void> {
  await zohoApiRequest(`/Contacts/${contactId}`, 'PUT', {
    data: [data],
  });
}

// ============================================
// DEAL MANAGEMENT
// ============================================

export async function createDeal(deal: ZohoDeal): Promise<{ id: string }> {
  const result = await zohoApiRequest('/Deals', 'POST', {
    data: [deal],
  }) as { data: Array<{ details: { id: string } }> };

  return { id: result.data[0].details.id };
}

export async function updateDealStage(dealId: string, stage: ZohoDeal['stage']): Promise<void> {
  await zohoApiRequest(`/Deals/${dealId}`, 'PUT', {
    data: [{ Stage: stage }],
  });
}

// ============================================
// SESSION TRACKING
// ============================================

// Custom module for tracking sessions (needs to be created in Zoho CRM)
export async function createSessionRecord(session: ZohoSessionRecord): Promise<{ id: string }> {
  const result = await zohoApiRequest('/Sessions', 'POST', {
    data: [{
      Name: `${session.sessionType}-${session.sessionId}`,
      User_ID: session.userId,
      Session_ID: session.sessionId,
      Session_Type: session.sessionType,
      Product_Module: session.productModule,
      Score: session.score,
      Duration: session.duration,
      Completed_At: session.completedAt.toISOString(),
    }],
  }) as { data: Array<{ details: { id: string } }> };

  return { id: result.data[0].details.id };
}

export async function getUserSessions(userId: string): Promise<ZohoSessionRecord[]> {
  const result = await zohoApiRequest(
    `/Sessions/search?User_ID=${userId}`
  ) as { data?: ZohoSessionRecord[] };

  return result.data || [];
}

// ============================================
// ENTITLEMENT MANAGEMENT
// ============================================

export interface Entitlement {
  userId: string;
  productId: string;
  modules: Array<{
    moduleId: string;
    totalCycles: number;
    usedCycles: number;
  }>;
  purchasedAt: Date;
  expiresAt?: Date;
  paymentGateway: 'paystack' | 'lemonsqueezy';
  transactionId: string;
}

export async function createEntitlement(entitlement: Entitlement): Promise<{ id: string }> {
  // Store in Zoho CRM as a custom module
  const result = await zohoApiRequest('/Entitlements', 'POST', {
    data: [{
      Name: `ENT-${entitlement.userId}-${entitlement.productId}`,
      User_ID: entitlement.userId,
      Product_ID: entitlement.productId,
      Modules: JSON.stringify(entitlement.modules),
      Purchased_At: entitlement.purchasedAt.toISOString(),
      Expires_At: entitlement.expiresAt?.toISOString(),
      Payment_Gateway: entitlement.paymentGateway,
      Transaction_ID: entitlement.transactionId,
    }],
  }) as { data: Array<{ details: { id: string } }> };

  return { id: result.data[0].details.id };
}

export async function getEntitlement(userId: string, productId: string): Promise<Entitlement | null> {
  try {
    const result = await zohoApiRequest(
      `/Entitlements/search?User_ID=${userId}&Product_ID=${productId}`
    ) as { data?: Array<{ data: unknown }> };

    if (!result.data || result.data.length === 0) {
      return null;
    }

    const record = result.data[0] as Record<string, unknown>;
    return {
      userId: record.User_ID as string,
      productId: record.Product_ID as string,
      modules: JSON.parse(record.Modules as string),
      purchasedAt: new Date(record.Purchased_At as string),
      expiresAt: record.Expires_At ? new Date(record.Expires_At as string) : undefined,
      paymentGateway: record.Payment_Gateway as 'paystack' | 'lemonsqueezy',
      transactionId: record.Transaction_ID as string,
    };
  } catch {
    return null;
  }
}

export async function updateEntitlementUsage(
  entitlementId: string,
  moduleId: string,
  incrementBy: number = 1
): Promise<void> {
  // Get current entitlement
  const result = await zohoApiRequest(`/Entitlements/${entitlementId}`) as { 
    data: Array<{ Modules: string }> 
  };
  
  const modules = JSON.parse(result.data[0].Modules);
  const moduleIndex = modules.findIndex((m: { moduleId: string }) => m.moduleId === moduleId);
  
  if (moduleIndex >= 0) {
    modules[moduleIndex].usedCycles += incrementBy;
    
    await zohoApiRequest(`/Entitlements/${entitlementId}`, 'PUT', {
      data: [{ Modules: JSON.stringify(modules) }],
    });
  }
}

// ============================================
// SYNC USER TO CRM
// ============================================

export async function syncUserToCRM(userData: {
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  company?: string;
  clerkId: string;
}): Promise<{ leadId: string; isNew: boolean }> {
  const lead: ZohoLead = {
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    country: userData.country,
    company: userData.company,
    leadSource: 'App Registration',
    leadStatus: 'New',
    description: `Clerk ID: ${userData.clerkId}`,
    Customer_Type: 'Free',
  };

  const result = await createOrUpdateLead(lead);
  return { leadId: result.id, isNew: result.created };
}

// ============================================
// SYNC SESSION TO CRM
// ============================================

export async function syncSessionToCRM(sessionData: {
  userId: string;
  email: string;
  sessionId: string;
  sessionType: 'deck' | 'script' | 'live' | 'full';
  productModule: string;
  score: number;
  duration?: number;
}): Promise<void> {
  // 1. Update lead/contact with session info
  const contact = await getContactByEmail(sessionData.email);
  
  if (contact?.id) {
    await updateContact(contact.id, {
      Last_Session_Date: new Date().toISOString().split('T')[0],
      Last_Session_Score: sessionData.score,
      Total_Sessions_Used: (contact.Total_Sessions_Used || 0) + 1,
    });
  }

  // 2. Create session record
  await createSessionRecord({
    userId: sessionData.userId,
    sessionId: sessionData.sessionId,
    sessionType: sessionData.sessionType,
    productModule: sessionData.productModule,
    score: sessionData.score,
    duration: sessionData.duration,
    completedAt: new Date(),
  });
}
