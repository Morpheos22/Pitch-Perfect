import crypto from 'node:crypto';
import {
  validateFileTypeByCategory,
  validateFileSizeByCategory,
  type FileCategory,
} from '@/lib/file-validation';

// Storage Utilities for Pitch Perfect × Automagikal
// Multi-backend: Vercel Blob (primary) → Zoho WorkDrive (secondary) → Mock (dev)
//
// STORAGE PRIORITY:
//   1. Vercel Blob       — if BLOB_READ_WRITE_TOKEN is set (auto on Vercel)
//   2. Zoho WorkDrive    — if ZOHO_WORKDRIVE_* env vars are configured
//   3. Mock (in-memory)  — development only, not persistent
//
// CLIENT-SIDE UPLOAD (preferred):
//   For user-facing uploads, use @vercel/blob/client upload() via blob-upload.ts.
//   This server-side module is the fallback for server-to-server transfers.
//
// File validation constants are imported from lib/file-validation.ts — the single source of truth.

// ============================================
// ZOHO WORKDRIVE CONFIGURATION
// ============================================

const WORKDRIVE_CLIENT_ID = process.env.ZOHO_WORKDRIVE_CLIENT_ID;
const WORKDRIVE_CLIENT_SECRET = process.env.ZOHO_WORKDRIVE_CLIENT_SECRET;
const WORKDRIVE_REFRESH_TOKEN = process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN;
const WORKDRIVE_FOLDER_ID = process.env.ZOHO_WORKDRIVE_FOLDER_ID;

// Token caching (in-memory, per process)
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

// ============================================
// CONFIGURATION CHECK
// ============================================

/** Check if Zoho WorkDrive is properly configured */
export function isWorkDriveConfigured(): boolean {
  return !!(
    WORKDRIVE_CLIENT_ID &&
    WORKDRIVE_CLIENT_SECRET &&
    WORKDRIVE_REFRESH_TOKEN &&
    WORKDRIVE_FOLDER_ID
  );
}

/** Check if Vercel Blob is configured */
export function isVercelBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Check if ANY real storage backend is available */
export function isStorageConfigured(): boolean {
  return isWorkDriveConfigured() || isVercelBlobConfigured();
}

/** Get active storage backend name */
export function getStorageBackend(): string {
  if (isVercelBlobConfigured()) return 'vercel-blob';
  if (isWorkDriveConfigured()) return 'zoho-workdrive';
  return 'mock';
}

// ============================================
// OAUTH TOKEN MANAGEMENT
// ============================================

/**
 * Get a valid Zoho WorkDrive OAuth access token.
 * Uses the refresh token to obtain a new access token.
 * Caches the token until it expires.
 */
async function getWorkDriveAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  if (!isWorkDriveConfigured()) {
    throw new Error(
      'Zoho WorkDrive is not configured. Please set ZOHO_WORKDRIVE_CLIENT_ID, ZOHO_WORKDRIVE_CLIENT_SECRET, ZOHO_WORKDRIVE_REFRESH_TOKEN, and ZOHO_WORKDRIVE_FOLDER_ID environment variables.'
    );
  }

  const response = await fetch(
    'https://accounts.zoho.com/oauth/v2/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: WORKDRIVE_CLIENT_ID!,
        client_secret: WORKDRIVE_CLIENT_SECRET!,
        refresh_token: WORKDRIVE_REFRESH_TOKEN!,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to obtain Zoho WorkDrive access token: ${response.status} ${errorBody}`
    );
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedAccessToken = data.access_token;
  // Set expiry 60 seconds early to avoid edge cases
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return cachedAccessToken;
}

// ============================================
// FILE KEY GENERATION
// ============================================

/**
 * Generate a unique file key/path for organizing files in WorkDrive.
 * Format: {type}/{userId}/{timestamp}-{random}-{sanitizedName}
 */
export function generateFileKey(
  userId: string,
  type: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${type}/${userId}/${timestamp}-${random}-${sanitized}`;
}

// ============================================
// FILE VALIDATION
// ============================================

// File validation is now imported from lib/file-validation.ts.
// The old duplicate constants (DECK_EXTENSIONS, SCRIPT_EXTENSIONS, etc.)
// have been removed. Use validateFileTypeByCategory() and
// validateFileSizeByCategory() from file-validation.ts instead.

// validateFileTypeByCategory and validateFileSizeByCategory are now imported
// from lib/file-validation.ts. The local duplicates have been removed.

// ============================================
// UPLOAD RESULT TYPE
// ============================================

export interface UploadResult {
  key: string;
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileId?: string;  // Zoho WorkDrive file ID
}

// ============================================
// ZOHO WORKDRIVE API FUNCTIONS
// ============================================

/**
 * Upload a file to Zoho WorkDrive.
 * @param file - File content as Buffer
 * @param fileName - Name of the file to upload
 * @param folderId - WorkDrive folder ID to upload into
 * @returns Object with file ID, name, and download URL
 */
export async function uploadToWorkDrive(
  file: Buffer,
  fileName: string,
  folderId: string
): Promise<{ fileId: string; fileName: string; downloadUrl: string }> {
  const accessToken = await getWorkDriveAccessToken();

  const formData = new FormData();
  formData.append('filename', fileName);
  formData.append('parent_id', folderId);

  // Append file as a Blob with the correct name
  const blob = new Blob([new Uint8Array(file)]);
  formData.append('content', blob, fileName);

  const response = await fetch('https://workdrive.zoho.com/api/v1/upload', {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Zoho WorkDrive upload failed: ${response.status} ${errorBody}`
    );
  }

  const data = await response.json() as {
    data?: Array<{
      attributes?: {
        resource_id?: string;
        filename?: string;
        resource_type?: string;
      };
    }>;
    status: string;
  };

  if (data.status !== 'success' || !data.data?.[0]?.attributes) {
    throw new Error('Zoho WorkDrive upload returned unexpected response format.');
  }

  const fileAttr = data.data[0].attributes;
  const fileId = fileAttr.resource_id || '';

  return {
    fileId,
    fileName: fileAttr.filename || fileName,
    downloadUrl: `https://workdrive.zoho.com/api/v1/download/${fileId}`,
  };
}

/**
 * Get a download URL for a file stored in Zoho WorkDrive.
 * @param fileId - The WorkDrive file ID
 * @returns The download URL string
 */
export function getWorkDriveFileUrl(fileId: string): string {
  return `https://workdrive.zoho.com/api/v1/download/${fileId}`;
}

/**
 * Delete a file from Zoho WorkDrive.
 * @param fileId - The WorkDrive file ID to delete
 */
async function deleteWorkDriveFile(fileId: string): Promise<void> {
  const accessToken = await getWorkDriveAccessToken();

  const response = await fetch(
    `https://workdrive.zoho.com/api/v1/files/${fileId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Zoho WorkDrive delete failed: ${response.status} ${errorBody}`
    );
  }
}

// ============================================
// MAIN UPLOAD FUNCTION
// ============================================

/**
 * Upload a file using Zoho WorkDrive (if configured) or local mock storage.
 * This is the primary upload function used throughout the application.
 *
 * @param file - File to upload (File or Buffer)
 * @param userId - User ID for organizing files
 * @param type - File category ('deck', 'script', 'video')
 * @param originalName - Original file name
 * @param mimeType - MIME type of the file
 * @returns Upload result with file metadata and URL
 */
export async function uploadFile(
  file: File | Buffer,
  userId: string,
  type: FileCategory,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  // Convert File to Buffer if needed
  let buffer: Buffer;
  let fileSize: number;

  if (file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    fileSize = file.size;
  } else {
    buffer = file;
    fileSize = file.length;
  }

  // Validate file type and size using single source of truth
  const typeValidation = validateFileTypeByCategory(originalName, mimeType, type);
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }

  const sizeValidation = validateFileSizeByCategory(fileSize, type);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }

  const key = generateFileKey(userId, type, originalName);

  // ── STRATEGY 1: Vercel Blob (PRIMARY — direct, reliable, no external credentials) ──
  // Client-side upload via @vercel/blob/client is the preferred path for user uploads.
  // This server-side path serves as a fallback when client upload isn't possible
  // (e.g., server-to-server transfers, webhook-received files).
  if (isVercelBlobConfigured()) {
    try {
      const { put } = await import('@vercel/blob');
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const blobResult = await put(key, blob, {
        access: 'public',  // Store is public — 'private' would fail
        addRandomSuffix: true,
      });
      return {
        key,
        url: blobResult.url,
        fileName: originalName,
        fileSize,
        fileType: mimeType,
        fileId: blobResult.pathname,
      };
    } catch (blobError) {
      console.error('[Storage] Vercel Blob upload failed:', blobError);
      // Fall through to WorkDrive or mock
    }
  }

  // ── STRATEGY 2: Zoho WorkDrive (secondary — requires external OAuth credentials) ──
  if (isWorkDriveConfigured()) {
    try {
      const result = await uploadToWorkDrive(buffer, originalName, WORKDRIVE_FOLDER_ID!);
      return {
        key,
        url: result.downloadUrl,
        fileName: originalName,
        fileSize,
        fileType: mimeType,
        fileId: result.fileId,
      };
    } catch (workDriveError) {
      console.error('[Storage] WorkDrive upload failed:', workDriveError);
      // Fall through to mock
    }
  }

  // ── STRATEGY 3: Mock storage (development only, NOT persistent) ──
  console.warn('[Storage] No real storage configured (WorkDrive or Vercel Blob). Using mock storage. Files will NOT persist across server restarts.');
  mockStorage.set(key, {
    buffer,
    metadata: { originalName, mimeType, fileSize },
  });

  return {
    key,
    url: `mock://${key}`,
    fileName: originalName,
    fileSize,
    fileType: mimeType,
  };
}

// ============================================
// FILE CONTENT FETCHING
// ============================================

/**
 * Fetch file content from a URL as a Buffer.
 * Supports both Zoho WorkDrive download URLs and generic URLs.
 */
export async function getFileContent(fileUrl: string): Promise<Buffer> {
  // Block mock:// URLs in production
  if (fileUrl.startsWith('mock://')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock URLs not allowed in production');
    }
    const key = fileUrl.replace('mock://', '');
    const entry = mockStorage.get(key);
    if (!entry) {
      throw new Error(`Mock file not found: ${key}`);
    }
    return entry.buffer;
  }

  // SSRF protection: block private IPs and non-https schemes
  try {
    const parsedUrl = new URL(fileUrl);
    if (parsedUrl.protocol !== 'https:') {
      throw new Error(`Unsupported URL scheme: ${parsedUrl.protocol}`);
    }
    const hostname = parsedUrl.hostname;
    // Block private IP ranges
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      hostname.startsWith('169.254.') ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      throw new Error('Access to private/internal URLs is blocked');
    }
  } catch (ssrfError) {
    if (ssrfError instanceof TypeError) {
      throw new Error(`Invalid URL: ${fileUrl}`);
    }
    throw ssrfError;
  }

  // Handle Vercel Blob URLs (public access — store is public, not private)
  // CRITICAL: Vercel Blob URLs use subdomain format:
  //   Public blobs:  https://<store-slug>.public.blob.vercel-storage.com/...
  //   Private blobs: https://<store-slug>.blob.vercel-storage.com/...
  //
  // This project uses a PUBLIC blob store. Public blob URLs are directly
  // fetchable without authentication — no need for the SDK get() function.
  // We just fetch() the URL directly like any other HTTP resource.
  let parsedBlobUrl: URL | null = null;
  try {
    parsedBlobUrl = new URL(fileUrl);
  } catch { /* not a valid URL, will be handled below */ }

  const isVercelBlob = parsedBlobUrl && (
    parsedBlobUrl.hostname.endsWith('.blob.vercel-storage.com') ||
    parsedBlobUrl.hostname.endsWith('.public.blob.vercel-storage.com') ||
    parsedBlobUrl.hostname === 'blob.vercel-storage.com'
  );

  if (isVercelBlob) {
    // Public blob URLs can be fetched directly with fetch() — no SDK needed.
    // The random suffix in the pathname provides adequate security.
    console.log(`[Storage] Fetching public blob: ${fileUrl.substring(0, 100)}`);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      // Fallback: try using the SDK with access: 'public' in case the URL expired
      // or has authentication requirements we don't know about
      console.warn(`[Storage] Direct fetch failed (${response.status}), trying SDK fallback...`);
      try {
        const { fetchBlob } = await import('./blob-signature');
        const pathname = fileUrl.split('.blob.vercel-storage.com/')[1];
        if (pathname) {
          return fetchBlob(pathname);
        }
      } catch (sdkErr) {
        console.error('[Storage] SDK fallback also failed:', sdkErr);
      }
      throw new Error(
        `Failed to fetch blob content: ${response.status} ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Handle Zoho WorkDrive download URLs
  if (fileUrl.includes('workdrive.zoho.com/api/v1/download/')) {
    const accessToken = await getWorkDriveAccessToken();
    const response = await fetch(fileUrl, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch file from WorkDrive: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Generic URL fetch (now SSRF-protected by the check above)
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch file from URL: ${response.status} ${response.statusText}`
    );
  }

  // Guard against excessively large responses (100MB safety limit)
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  const MAX_FETCH_SIZE = 100 * 1024 * 1024; // 100MB
  if (contentLength > MAX_FETCH_SIZE) {
    throw new Error(
      `File too large for server-side processing (${(contentLength / 1024 / 1024).toFixed(1)}MB). Maximum is 100MB.`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  // Double-check actual size (Content-Length may be missing/ inaccurate)
  if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
    throw new Error(
      `File too large for server-side processing (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB). Maximum is 100MB.`
    );
  }
  return Buffer.from(arrayBuffer);
}

// ============================================
// MOCK STORAGE (Development Fallback)
// ============================================

/** In-memory mock storage for when WorkDrive is not configured */
const mockStorage = new Map<string, { buffer: Buffer; metadata: Record<string, unknown> }>();
