// Storage Utilities for Pitch Perfect × Automagikal
// Multi-backend: Zoho WorkDrive (primary) → Vercel Blob (fallback) → Mock (dev)
//
// STORAGE PRIORITY:
//   1. Zoho WorkDrive — if ZOHO_WORKDRIVE_* env vars are configured
//   2. Vercel Blob       — if BLOB_READ_WRITE_TOKEN is set (auto on Vercel)
//   3. Mock (in-memory)  — development only, not persistent

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
  if (isWorkDriveConfigured()) return 'zoho-workdrive';
  if (isVercelBlobConfigured()) return 'vercel-blob';
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
export async function getWorkDriveAccessToken(): Promise<string> {
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
  const random = Math.random().toString(36).substring(2, 8);
  const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${type}/${userId}/${timestamp}-${random}-${sanitized}`;
}

// ============================================
// FILE VALIDATION
// ============================================

/** Allowed file extensions by category */
const DECK_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.html', '.docx', '.doc', '.txt'];
const SCRIPT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.html'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];

/** Allowed MIME types by category */
const ALLOWED_DECK_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/plain',
];
const ALLOWED_SCRIPT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/plain',
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
];

/** File size limits in bytes */
const FILE_SIZE_LIMITS = {
  deck: 50 * 1024 * 1024,   // 50MB
  script: 10 * 1024 * 1024,  // 10MB
  video: 500 * 1024 * 1024,  // 500MB
};

/**
 * Validate file extension against a list of allowed types.
 * @param fileName - The file name to check
 * @param allowedTypes - Array of allowed file extensions (e.g. ['.pdf', '.pptx'])
 * @returns Object with valid flag and optional error message
 */
export function validateFileType(
  fileName: string,
  allowedTypes: string[]
): { valid: boolean; error?: string } {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!allowedTypes.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file type (.${ext}). Allowed types: ${allowedTypes.join(', ')}`,
    };
  }
  return { valid: true };
}

/**
 * Convenience: validate file type by category (deck, script, video).
 * Checks both extension and MIME type.
 */
export function validateFileTypeByCategory(
  fileName: string,
  mimeType: string,
  type: 'deck' | 'script' | 'video'
): { valid: boolean; error?: string } {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

  switch (type) {
    case 'deck':
      if (!ALLOWED_DECK_TYPES.includes(mimeType) || !DECK_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Please upload a PDF or PowerPoint file.' };
      }
      break;
    case 'script':
      if (!ALLOWED_SCRIPT_TYPES.includes(mimeType) || !SCRIPT_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Please upload a PDF, Word, or text file.' };
      }
      break;
    case 'video':
      if (!ALLOWED_VIDEO_TYPES.includes(mimeType) || !VIDEO_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Please upload an MP4, WebM, MOV, or AVI file.' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Validate file size against a maximum.
 * @param fileSize - Size of the file in bytes
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns Object with valid flag and optional error message
 */
export function validateFileSize(
  fileSize: number,
  maxSizeBytes: number
): { valid: boolean; error?: string } {
  if (fileSize > maxSizeBytes) {
    const limitMB = maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${limitMB}MB limit.`,
    };
  }
  return { valid: true };
}

/**
 * Convenience: validate file size by category.
 */
export function validateFileSizeByCategory(
  size: number,
  type: 'deck' | 'script' | 'video'
): { valid: boolean; error?: string } {
  return validateFileSize(size, FILE_SIZE_LIMITS[type]);
}

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
  const blob = new Blob([file]);
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
export async function deleteWorkDriveFile(fileId: string): Promise<void> {
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
  type: 'deck' | 'script' | 'video',
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

  // Validate file type
  const typeValidation = validateFileTypeByCategory(originalName, mimeType, type);
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }

  // Validate file size
  const sizeValidation = validateFileSizeByCategory(fileSize, type);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }

  const key = generateFileKey(userId, type, originalName);

  // ── STRATEGY 1: Zoho WorkDrive ──
  if (isWorkDriveConfigured()) {
    const result = await uploadToWorkDrive(buffer, originalName, WORKDRIVE_FOLDER_ID!);
    return {
      key,
      url: result.downloadUrl,
      fileName: originalName,
      fileSize,
      fileType: mimeType,
      fileId: result.fileId,
    };
  }

  // ── STRATEGY 2: Vercel Blob (real persistent storage) ──
  if (isVercelBlobConfigured()) {
    try {
      const { put } = await import('@vercel/blob');
      const blob = new Blob([buffer], { type: mimeType });
      const blobResult = await put(key, blob, {
        access: 'public',
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
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
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

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================
// MOCK STORAGE (Development Fallback)
// ============================================

/** In-memory mock storage for when WorkDrive is not configured */
const mockStorage = new Map<string, { buffer: Buffer; metadata: Record<string, unknown> }>();
