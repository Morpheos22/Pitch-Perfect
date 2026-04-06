// Zoho WorkDrive Integration Service for Pitch Perfect × Automagikal
// Handles file storage for founder decks, reports, session recordings

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Role assigned when sharing a file or folder */
export type ShareRole = 'viewer' | 'editor' | 'organizer';

/** Metadata for a file stored in WorkDrive */
export interface WorkDriveFile {
  id: string;
  name: string;
  type: 'files' | 'folders' | 'links';
  parentId: string;
  createdTime: string;
  modifiedTime: string;
  size?: number;
  mimeType?: string;
  owner?: string;
}

/** Information about a folder in WorkDrive */
export interface WorkDriveFolder {
  id: string;
  name: string;
  parentId: string;
  createdTime: string;
  modifiedTime: string;
  childCount: number;
}

/** Result of a file upload operation */
export interface UploadResult {
  fileId: string;
  fileName: string;
  revisionId: string;
}

/** Result of a file share operation */
export interface ShareResult {
  shareId: string;
  fileId: string;
  email: string;
  role: ShareRole;
}

/** Public link information */
export interface PublicLink {
  linkId: string;
  url: string;
  role: ShareRole;
  expiryDate?: string;
}

// ============================================
// ZOHO WORKDRIVE API CONFIGURATION
// ============================================

const ZOHO_WORKDRIVE_CONFIG = {
  clientId: process.env.ZOHO_WORKDRIVE_CLIENT_ID,
  clientSecret: process.env.ZOHO_WORKDRIVE_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_WORKDRIVE_API_DOMAIN || 'https://www.zohoapis.com/workdrive',
};

// Independent token cache for WorkDrive
let workDriveTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  if (workDriveTokenCache && workDriveTokenCache.expiresAt > Date.now()) {
    return workDriveTokenCache.token;
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_WORKDRIVE_CONFIG.clientId!,
      client_secret: ZOHO_WORKDRIVE_CONFIG.clientSecret!,
      refresh_token: ZOHO_WORKDRIVE_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho WorkDrive auth failed: ${response.status}`);
  }

  const data = await response.json();
  workDriveTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function workDriveRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object | FormData,
  headersOverrides?: Record<string, string>,
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_WORKDRIVE_CONFIG.apiDomain}/api/v1${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${token}`,
    ...headersOverrides,
  };

  if (data && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho WorkDrive API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

// ============================================
// FILE OPERATIONS
// ============================================

/**
 * Upload a file to a team folder in WorkDrive.
 * Supports founder decks, reports, session recordings, etc.
 * @param teamFolderId - Destination folder ID
 * @param fileName - Name for the uploaded file
 * @param fileBuffer - Raw file content as a Buffer
 * @param mimeType - MIME type of the file (e.g. 'application/pdf')
 */
export async function uploadFile(
  teamFolderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer as unknown as BlobPart], { type: mimeType });
  formData.append('content', blob, fileName);

  const result = await workDriveRequest(
    `/upload?parent_id=${teamFolderId}`,
    'POST',
    formData,
  ) as { data: Array<{ id: string; filename: string; revision_id: string }> };

  if (!result.data || result.data.length === 0) {
    throw new Error('WorkDrive upload returned no file data');
  }

  return {
    fileId: result.data[0].id,
    fileName: result.data[0].filename,
    revisionId: result.data[0].revision_id,
  };
}

/**
 * Download a file from WorkDrive.
 * @param fileId - The file identifier to download
 * @returns Raw Response object (call .arrayBuffer() to get bytes)
 */
export async function downloadFile(fileId: string): Promise<Response> {
  const token = await getAccessToken();
  const url = `${ZOHO_WORKDRIVE_CONFIG.apiDomain}/api/v1/download/${fileId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Zoho WorkDrive download error: ${response.status}`);
  }

  return response;
}

/**
 * Get detailed metadata for a single file.
 * @param fileId - The file identifier
 */
export async function getFileInfo(fileId: string): Promise<WorkDriveFile> {
  const result = await workDriveRequest(`/files/${fileId}`) as {
    data: WorkDriveFile;
  };
  return result.data;
}

/**
 * Delete a file from WorkDrive.
 * @param fileId - The file identifier to permanently remove
 */
export async function deleteFile(fileId: string): Promise<void> {
  await workDriveRequest(`/files/${fileId}`, 'DELETE');
}

// ============================================
// FOLDER OPERATIONS
// ============================================

/**
 * Create a new folder inside an existing parent folder.
 * @param parentId - Parent folder or team folder ID
 * @param folderName - Name for the new folder
 */
export async function createFolder(
  parentId: string,
  folderName: string,
): Promise<{ folderId: string }> {
  const result = await workDriveRequest('/files', 'POST', {
    data: {
      attributes: {
        name: folderName,
        parent_id: parentId,
        type: 'folders',
      },
    },
  }) as { data: Array<{ id: string }> };

  if (!result.data || result.data.length === 0) {
    throw new Error('WorkDrive folder creation returned no data');
  }

  return { folderId: result.data[0].id };
}

/**
 * List all files and folders inside a given folder.
 * @param folderId - The folder to list contents of
 */
export async function listFiles(folderId: string): Promise<WorkDriveFile[]> {
  const result = await workDriveRequest(
    `/files/${folderId}/files?page[number]=1&page[size]=100`,
  ) as { data: WorkDriveFile[] };

  return result.data || [];
}

// ============================================
// SHARING & COLLABORATION
// ============================================

/**
 * Share a file with a specific email address.
 * @param fileId - The file to share
 * @param email - Recipient email address
 * @param role - Permission level (viewer, editor, organizer)
 */
export async function shareFile(
  fileId: string,
  email: string,
  role: ShareRole,
): Promise<ShareResult> {
  const result = await workDriveRequest(`/files/${fileId}/shares`, 'POST', {
    data: {
      attributes: {
        email,
        role,
        notify: true,
      },
      type: 'shares',
    },
  }) as { data: { id: string } };

  return {
    shareId: result.data.id,
    fileId,
    email,
    role,
  };
}

/**
 * Generate a public shareable link for a file.
 * @param fileId - The file to create a public link for
 */
export async function getPublicLink(fileId: string): Promise<PublicLink> {
  const result = await workDriveRequest(`/files/${fileId}/links`, 'POST', {
    data: {
      attributes: {
        role: 'viewer',
      },
      type: 'links',
    },
  }) as { data: { id: string; url: string; role: string } };

  return {
    linkId: result.data.id,
    url: result.data.url,
    role: result.data.role as ShareRole,
  };
}
