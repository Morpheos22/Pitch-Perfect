// Zoho CRM Integration Service for Pitch Perfect
// Handles lead management and contact sync
//
// Previously contained ~200 lines of dead CRM functions (deal management,
// session tracking, entitlement management) that were never called.
// Only createOrUpdateLead and syncUserToCRM are used externally.

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ZohoLead {
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
