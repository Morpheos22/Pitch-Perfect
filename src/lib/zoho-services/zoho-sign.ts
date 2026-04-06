// Zoho Sign Integration Service for Pitch Perfect × Automagikal
// Digital signatures for founder agreements, terms of service, NDAs, investor documents

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Document signing status */
export type SignStatus =
  | 'draft'
  | 'sent'
  | 'signed'
  | 'viewed'
  | 'out_for_signature'
  | 'declined'
  | 'expired'
  | 'completed';

/** A field to place on a signing document */
export interface SignField {
  fieldName: string;
  fieldType: 'signature' | 'date' | 'text' | 'checkbox' | 'dropdown';
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isMandatory?: boolean;
  defaultValue?: string;
}

/** Sign template definition */
export interface SignTemplate {
  templateId: string;
  name: string;
  description?: string;
  createdAt: string;
  fieldCount: number;
}

/** Sign document (agreement) */
export interface SignDocument {
  documentId: string;
  requestName: string;
  status: SignStatus;
  createdAt: string;
  lastModifiedAt: string;
  recipients: Array<{
    email: string;
    name: string;
    actionType: 'SIGNER' | 'APPROVER' | 'IN_PERSON_SIGNER';
    status: string;
  }>;
}

/** Created document result */
export interface CreatedDocument {
  documentId: string;
  requestId: string;
}

// ============================================
// ZOHO SIGN API CONFIGURATION
// ============================================

const ZOHO_SIGN_CONFIG = {
  clientId: process.env.ZOHO_SIGN_CLIENT_ID,
  clientSecret: process.env.ZOHO_SIGN_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_SIGN_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_SIGN_API_DOMAIN || 'https://www.zohoapis.com/sign',
};

// Independent token cache for Sign
let signTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  if (signTokenCache && signTokenCache.expiresAt > Date.now()) {
    return signTokenCache.token;
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_SIGN_CONFIG.clientId!,
      client_secret: ZOHO_SIGN_CONFIG.clientSecret!,
      refresh_token: ZOHO_SIGN_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho Sign auth failed: ${response.status}`);
  }

  const data = await response.json();
  signTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function signRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_SIGN_CONFIG.apiDomain}/api/v1${endpoint}`;

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
    throw new Error(`Zoho Sign API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

/**
 * Create a new reusable signing template.
 * Templates define the document layout and field positions.
 * @param name - Template name (e.g. "Founder NDA v2")
 * @param fields - Array of field definitions to place on the template
 */
export async function createTemplate(
  name: string,
  fields: SignField[],
): Promise<{ templateId: string }> {
  const result = await signRequest('/templates', 'POST', {
    templates: {
      templateName: name,
      fields,
    },
  }) as {
    templates: Array<{ templateId: string }>;
  };

  if (!result.templates || result.templates.length === 0) {
    throw new Error('Failed to create Sign template — no data returned');
  }

  return { templateId: result.templates[0].templateId };
}

// ============================================
// DOCUMENT MANAGEMENT
// ============================================

/**
 * Create a new signing document from a template.
 * Pre-fills fields and assigns a recipient.
 * @param templateId - The template to use as the base
 * @param recipientEmail - Signer's email address
 * @param recipientName - Signer's full name
 * @param fields - Optional field values to pre-fill
 */
export async function createDocument(
  templateId: string,
  recipientEmail: string,
  recipientName: string,
  fields?: Array<{ fieldName: string; defaultValue: string }>,
): Promise<CreatedDocument> {
  const data: Record<string, unknown> = {
    requests: {
      requestName: `Agreement for ${recipientName}`,
      isQuicksend: true,
      notes: 'Please review and sign this document.',
      recipients: [
        {
          recipientName,
          recipientEmail,
          actionType: 'SIGNER',
          verifyRecipient: false,
        },
      ],
      templateIds: [templateId],
    },
  };

  if (fields && fields.length > 0) {
    (data.requests as Record<string, unknown>).fieldData = {
      fields,
    };
  }

  const result = await signRequest('/requests', 'POST', data) as {
    requests: Array<{
      request_id: string;
      document_id: string;
    }>;
  };

  if (!result.requests || result.requests.length === 0) {
    throw new Error('Failed to create Sign document — no data returned');
  }

  return {
    documentId: result.requests[0].document_id,
    requestId: result.requests[0].request_id,
  };
}

/**
 * Send a draft document to its recipients for signing.
 * @param documentId - The document to send
 */
export async function sendDocument(documentId: string): Promise<void> {
  await signRequest(`/requests/${documentId}`, 'POST', {});
}

/**
 * Get the current status of a signing document.
 * @param documentId - The document to check
 */
export async function getDocumentStatus(documentId: string): Promise<SignDocument> {
  const result = await signRequest(`/requests/${documentId}`) as {
    requests: SignDocument[];
  };

  if (!result.requests || result.requests.length === 0) {
    throw new Error(`No document found with ID: ${documentId}`);
  }

  return result.requests[0];
}

/**
 * Download the fully signed PDF document.
 * Only available after all signers have completed signing.
 * @param documentId - The completed document to download
 * @returns Raw Response with PDF bytes
 */
export async function downloadSignedDocument(documentId: string): Promise<Response> {
  const token = await getAccessToken();
  const url = `${ZOHO_SIGN_CONFIG.apiDomain}/api/v1/requests/${documentId}/document`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Zoho Sign download error: ${response.status}`);
  }

  return response;
}
