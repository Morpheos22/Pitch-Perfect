// Zoho Campaigns Integration Service for Pitch Perfect × Automagikal
// Email marketing — founder nurture sequences, product updates, event invitations

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Contact to add to a mailing list */
export interface CampaignContact {
  email: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  company?: string;
  customFields?: Record<string, string>;
}

/** Campaign status */
export type CampaignStatus = 'sent' | 'scheduled' | 'draft' | 'sending';

/** Campaign details */
export interface Campaign {
  campaignId: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  fromEmail: string;
  listKey: string;
  sentCount?: number;
  openCount?: number;
  clickCount?: number;
  bounceCount?: number;
  createdAt: string;
}

/** Campaign statistics */
export interface CampaignStats {
  campaignId: string;
  totalSent: number;
  delivered: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  bounces: number;
  unsubscribes: number;
  spamComplaints: number;
}

/** Contact list returned from API */
export interface ContactList {
  listKey: string;
  name: string;
  contactCount: number;
  createdAt: string;
}

// ============================================
// ZOHO CAMPAIGNS API CONFIGURATION
// ============================================

const ZOHO_CAMPAIGNS_CONFIG = {
  clientId: process.env.ZOHO_CAMPAIGNS_CLIENT_ID,
  clientSecret: process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_CAMPAIGNS_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_CAMPAIGNS_API_DOMAIN || 'https://www.zohoapis.com/campaigns',
};

// Independent token cache for Campaigns
let campaignsTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  if (campaignsTokenCache && campaignsTokenCache.expiresAt > Date.now()) {
    return campaignsTokenCache.token;
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CAMPAIGNS_CONFIG.clientId!,
      client_secret: ZOHO_CAMPAIGNS_CONFIG.clientSecret!,
      refresh_token: ZOHO_CAMPAIGNS_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho Campaigns auth failed: ${response.status}`);
  }

  const data = await response.json();
  campaignsTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function campaignsRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_CAMPAIGNS_CONFIG.apiDomain}/api/v1.1${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${token}`,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho Campaigns API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ============================================
// CONTACT LIST MANAGEMENT
// ============================================

/**
 * Create a new contact list (mailing list).
 * @param name - List name (e.g. "Founders — Active", "Investors — Q1 2026")
 */
export async function createContactList(name: string): Promise<{ listKey: string }> {
  const result = await campaignsRequest('/contactlists', 'POST', {
    listName: name,
    signupFormEnabled: false,
  }) as {
    contactlist: Array<{ listKey: string }>;
  };

  if (!result.contactlist || result.contactlist.length === 0) {
    throw new Error('Failed to create contact list — no data returned');
  }

  return { listKey: result.contactlist[0].listKey };
}

/**
 * Add contacts to an existing mailing list.
 * Supports batch additions for importing founder lists.
 * @param listKey - The target contact list key
 * @param contacts - Array of contacts to add
 */
export async function addContactsToList(
  listKey: string,
  contacts: CampaignContact[],
): Promise<{ addedCount: number; failedCount: number }> {
  const result = await campaignsRequest(
    `/contactlists/${listKey}/subscribers`,
    'POST',
    {
      subscriptionDetails: contacts.map((c) => ({
        contact: {
          email: c.email,
          first_name: c.firstName || '',
          last_name: c.lastName || '',
          job_title: c.jobTitle || '',
          company: c.company || '',
          ...(c.customFields || {}),
        },
        status: 'subscribed',
      })),
    },
  ) as {
    status: string;
    summary: { addedCount: number; failedCount: number };
  };

  return {
    addedCount: result.summary?.addedCount || 0,
    failedCount: result.summary?.failedCount || 0,
  };
}

// ============================================
// CAMPAIGN MANAGEMENT
// ============================================

/**
 * Create a new email campaign.
 * @param name - Internal campaign name
 * @param subject - Email subject line
 * @param htmlContent - Full HTML body of the email
 * @param fromEmail - Sender email address (must be verified in Zoho Campaigns)
 * @param listKey - The contact list to send to
 */
export async function createCampaign(
  name: string,
  subject: string,
  htmlContent: string,
  fromEmail: string,
  listKey: string,
): Promise<{ campaignId: string }> {
  const result = await campaignsRequest('/campaigns', 'POST', {
    campaignName: name,
    subject,
    htmlContent,
    fromEmail,
    replyTo: fromEmail,
    contactList: [listKey],
    type: 'regular',
  }) as {
    campaign: { campaignKey: string };
  };

  return { campaignId: result.campaign.campaignKey };
}

/**
 * Immediately send a previously created campaign to its target list.
 * @param campaignId - The campaign to send
 */
export async function sendCampaign(campaignId: string): Promise<void> {
  await campaignsRequest(`/campaigns/${campaignId}/action/send`, 'POST', {});
}

/**
 * Retrieve delivery and engagement statistics for a campaign.
 * Includes open rate, click rate, bounces, and unsubscribes.
 * @param campaignId - The campaign to get stats for
 */
export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const result = await campaignsRequest(`/campaigns/${campaignId}/stats`) as {
    sent: number;
    delivered: number;
    opens: number;
    uniqueOpens: number;
    clicks: number;
    uniqueClicks: number;
    bounces: number;
    unsubscribes: number;
    spamComplaints: number;
  };

  return {
    campaignId,
    totalSent: result.sent || 0,
    delivered: result.delivered || 0,
    opens: result.opens || 0,
    uniqueOpens: result.uniqueOpens || 0,
    clicks: result.clicks || 0,
    uniqueClicks: result.uniqueClicks || 0,
    bounces: result.bounces || 0,
    unsubscribes: result.unsubscribes || 0,
    spamComplaints: result.spamComplaints || 0,
  };
}
