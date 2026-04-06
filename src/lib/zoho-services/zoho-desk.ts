// Zoho Desk Integration Service for Pitch Perfect × Automagikal
// Handles support ticket management for founder inquiries, technical issues, billing

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Ticket priority levels */
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

/** Ticket status */
export type TicketStatus = 'Open' | 'On Hold' | 'Escalated' | 'Closed';

/** Ticket category */
export type TicketCategory = 'Technical Support' | 'Billing' | 'Feature Request' | 'General Inquiry' | 'Account Issue';

/** Support ticket */
export interface DeskTicket {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  email: string;
  contactId?: string;
  departmentId?: string;
  createdAt: string;
  updatedAt: string;
  comments?: TicketComment[];
}

/** Comment on a ticket */
export interface TicketComment {
  id: string;
  content: string;
  author: string;
  isPublic: boolean;
  createdAt: string;
}

// ============================================
// ZOHO DESK API CONFIGURATION
// ============================================

const ZOHO_DESK_CONFIG = {
  clientId: process.env.ZOHO_DESK_CLIENT_ID,
  clientSecret: process.env.ZOHO_DESK_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_DESK_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_DESK_API_DOMAIN || 'https://www.zohoapis.com/desk',
  orgId: process.env.ZOHO_DESK_ORG_ID,
};

// Independent token cache for Desk
let deskTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  if (deskTokenCache && deskTokenCache.expiresAt > Date.now()) {
    return deskTokenCache.token;
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_DESK_CONFIG.clientId!,
      client_secret: ZOHO_DESK_CONFIG.clientSecret!,
      refresh_token: ZOHO_DESK_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho Desk auth failed: ${response.status}`);
  }

  const data = await response.json();
  deskTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function deskRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_DESK_CONFIG.apiDomain}/api/v1${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${token}`,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  if (ZOHO_DESK_CONFIG.orgId) {
    headers['orgId'] = ZOHO_DESK_CONFIG.orgId;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho Desk API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ============================================
// TICKET MANAGEMENT
// ============================================

/**
 * Create a new support ticket.
 * @param subject - Ticket subject line
 * @param description - Full description of the issue
 * @param email - Reporter email address
 * @param category - Ticket category for routing
 * @param priority - Ticket priority
 */
export async function createTicket(
  subject: string,
  description: string,
  email: string,
  category: TicketCategory = 'General Inquiry',
  priority: TicketPriority = 'Medium',
): Promise<{ ticketId: string; ticketNumber: string }> {
  const result = await deskRequest('/tickets', 'POST', {
    subject,
    description,
    email,
    category,
    priority,
    departmentId: 'default',
  }) as { ticketId: string; ticketNumber: string };

  return { ticketId: result.ticketId, ticketNumber: result.ticketNumber };
}

/**
 * Update an existing ticket's status and optionally add a comment.
 * @param ticketId - The ticket to update
 * @param status - New status to set
 * @param comment - Optional comment explaining the status change
 */
export async function updateTicket(
  ticketId: string,
  status: TicketStatus,
  comment?: string,
): Promise<void> {
  const data: Record<string, unknown> = { status };
  if (comment) {
    data.comment = comment;
  }
  await deskRequest(`/tickets/${ticketId}`, 'PUT', data);
}

/**
 * Retrieve full details for a single ticket including comments.
 * @param ticketId - Zoho Desk ticket identifier
 */
export async function getTicket(ticketId: string): Promise<DeskTicket> {
  const result = await deskRequest(`/tickets/${ticketId}`) as {
    ticket: DeskTicket;
  };
  return result.ticket;
}

/**
 * List all tickets associated with a contact email.
 * @param contactEmail - The email to search tickets for
 */
export async function listTickets(contactEmail: string): Promise<DeskTicket[]> {
  const result = await deskRequest(
    `/tickets?include=contacts,assignee,departments&email=${encodeURIComponent(contactEmail)}`,
  ) as { tickets: DeskTicket[] };

  return result.tickets || [];
}

/**
 * Add a public comment to a support ticket.
 * Visible to the ticket creator.
 * @param ticketId - The ticket to comment on
 * @param comment - Comment text
 * @param isPublic - Whether the comment is visible to the customer (default true)
 */
export async function addComment(
  ticketId: string,
  comment: string,
  isPublic: boolean = true,
): Promise<{ commentId: string }> {
  const result = await deskRequest(`/tickets/${ticketId}/comments`, 'POST', {
    body: comment,
    isPublic,
  }) as { commentId: string };

  return { commentId: result.commentId };
}
