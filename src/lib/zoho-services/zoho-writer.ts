// Zoho Writer Integration Service for Pitch Perfect × Automagikal
// Generates pitch reports, investor briefs, coaching summaries as branded documents
// Reuses CRM OAuth credentials (same Zoho account)

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Share role for Writer documents */
export type WriterShareRole = 'Read' | 'Write' | 'ReadWrite';

/** Document metadata returned from Zoho Writer */
export interface WriterDocument {
  documentId: string;
  title: string;
  createdAt: string;
  lastModifiedAt: string;
  owner?: string;
  url?: string;
}

/** Template merge data — key-value pairs for mail merge */
export type MergeData = Record<string, string | number | boolean>;

/** PDF export settings */
export interface PdfExportOptions {
  password?: string;
  quality?: 'high' | 'medium' | 'low';
  includeComments?: boolean;
  watermarkText?: string;
}

/** Share permission result */
export interface WriterShareResult {
  documentId: string;
  email: string;
  role: WriterShareRole;
  sharedAt: string;
}

// ============================================
// ZOHO WRITER API CONFIGURATION
// ============================================
// Writer shares the same Zoho account as CRM, so we reuse those env vars.

const ZOHO_WRITER_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com',
};

// Independent token cache for Writer
let writerTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  if (writerTokenCache && writerTokenCache.expiresAt > Date.now()) {
    return writerTokenCache.token;
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_WRITER_CONFIG.clientId!,
      client_secret: ZOHO_WRITER_CONFIG.clientSecret!,
      refresh_token: ZOHO_WRITER_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho Writer auth failed: ${response.status}`);
  }

  const data = await response.json();
  writerTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function writerRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_WRITER_CONFIG.apiDomain}/writer/api/v2${endpoint}`;

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
    throw new Error(`Zoho Writer API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

// ============================================
// DOCUMENT MANAGEMENT
// ============================================

/**
 * Create a new blank Writer document.
 * @param title - Document title
 * @param content - Optional initial HTML content for the document body
 */
export async function createDocument(
  title: string,
  content?: string,
): Promise<{ documentId: string }> {
  const result = await writerRequest('/documents', 'POST', {
    title,
    content: content || '',
  }) as { document_id: string };

  return { documentId: result.document_id };
}

// ============================================
// TEMPLATE MERGE
// ============================================

/**
 * Perform a mail merge on a template document, replacing placeholders with founder data.
 * Produces one merged document per row of data provided.
 * @param templateId - The template document identifier
 * @param mergeData - Key-value map where keys correspond to template merge fields
 */
export async function mergeTemplate(
  templateId: string,
  mergeData: MergeData,
): Promise<{ documentId: string }> {
  const result = await writerRequest(
    `/templates/${templateId}/merge/linkeddata`,
    'POST',
    {
      merge_data: {
        data: [mergeData],
      },
      output_format: 'zdoc',
    },
  ) as { merge_report: { document_id: string } };

  return { documentId: result.merge_report.document_id };
}

// ============================================
// PDF EXPORT
// ============================================

/**
 * Export a Writer document to PDF format.
 * @param documentId - The document to export
 * @param options - Optional PDF export settings (password, quality, watermark, etc.)
 * @returns PDF file as a Blob for download or attachment
 */
export async function exportToPdf(
  documentId: string,
  options?: PdfExportOptions,
): Promise<Blob> {
  const token = await getAccessToken();
  const url = `${ZOHO_WRITER_CONFIG.apiDomain}/writer/api/v2/documents/${documentId}/export/pdf`;

  const body: Record<string, unknown> = {};
  if (options?.password) body.password = options.password;
  if (options?.quality) body.quality = options.quality;
  if (options?.includeComments) body.include_comments = options.includeComments;
  if (options?.watermarkText) body.watermark_text = options.watermarkText;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho Writer PDF export error: ${response.status} - ${errorText}`);
  }

  return response.blob();
}

// ============================================
// DOCUMENT SHARING
// ============================================

/**
 * Share a Writer document with another user by email.
 * @param documentId - The document to share
 * @param email - Recipient email address
 * @param role - Permission level for the recipient
 */
export async function shareDocument(
  documentId: string,
  email: string,
  role: WriterShareRole = 'Read',
): Promise<WriterShareResult> {
  await writerRequest(`/documents/${documentId}/collaborators`, 'POST', {
    emails: [email],
    role,
  });

  return {
    documentId,
    email,
    role,
    sharedAt: new Date().toISOString(),
  };
}
