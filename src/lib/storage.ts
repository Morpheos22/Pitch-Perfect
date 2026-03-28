// Cloudflare R2 Storage Utilities
// Handles file uploads for PDF, PPTX, and video files

// R2 Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pitchcoach-files';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

// Check if R2 is configured
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

// Get R2 API endpoint
function getR2Endpoint(): string {
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

// Get public URL for a file
export function getR2FileUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // Fallback to R2 public bucket URL
  return `https://pub-${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${key}`;
}

// Generate unique file key
export function generateFileKey(userId: string, type: 'deck' | 'script' | 'video', fileName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${type}/${userId}/${timestamp}-${random}-${sanitized}`;
}

// Allowed file types
const ALLOWED_DECK_TYPES = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
const ALLOWED_SCRIPT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

const DECK_EXTENSIONS = ['.pdf', '.ppt', '.pptx'];
const SCRIPT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi'];

// File validation
export function validateFileType(
  fileName: string,
  mimeType: string,
  type: 'deck' | 'script' | 'video'
): { valid: boolean; error?: string } {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  
  switch (type) {
    case 'deck':
      if (!ALLOWED_DECK_TYPES.includes(mimeType) && !DECK_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Please upload a PDF or PowerPoint file.' };
      }
      break;
    case 'script':
      if (!ALLOWED_SCRIPT_TYPES.includes(mimeType) && !SCRIPT_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Please upload a PDF, Word, or text file.' };
      }
      break;
    case 'video':
      if (!ALLOWED_VIDEO_TYPES.includes(mimeType) && !VIDEO_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Please upload an MP4, WebM, MOV, or AVI file.' };
      }
      break;
  }
  
  return { valid: true };
}

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  deck: 50 * 1024 * 1024, // 50MB
  script: 10 * 1024 * 1024, // 10MB
  video: 500 * 1024 * 1024, // 500MB
};

export function validateFileSize(size: number, type: 'deck' | 'script' | 'video'): { valid: boolean; error?: string } {
  const limit = FILE_SIZE_LIMITS[type];
  if (size > limit) {
    const limitMB = limit / (1024 * 1024);
    return { valid: false, error: `File size exceeds ${limitMB}MB limit.` };
  }
  return { valid: true };
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

interface UploadResult {
  key: string;
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

// Upload file to R2 using S3-compatible API
export async function uploadToR2(
  file: Buffer | File,
  userId: string,
  type: 'deck' | 'script' | 'video',
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured. Please set up R2 credentials.');
  }

  // Validate file
  const typeValidation = validateFileType(originalName, mimeType, type);
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }

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

  // Validate size
  const sizeValidation = validateFileSize(fileSize, type);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error);
  }

  // Generate unique key
  const key = generateFileKey(userId, type, originalName);

  // Upload to R2 using fetch with S3 API
  const endpoint = getR2Endpoint();
  const url = `${endpoint}/${R2_BUCKET_NAME}/${key}`;

  // Create AWS Signature V4 for authentication
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const datetimeStr = date.toISOString().replace(/[:-]|\.\d{3}/g, '');

  // For simplicity, we'll use a presigned URL approach or direct upload
  // In production, you'd want to use AWS SDK with proper signing
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileSize.toString(),
      // Note: In production, you need proper AWS Signature V4 headers
      // This is a simplified version
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return {
    key,
    url: getR2FileUrl(key),
    fileName: originalName,
    fileSize,
    fileType: mimeType,
  };
}

// ============================================
// PRESIGNED URL GENERATION
// For direct client-side uploads
// ============================================

export async function generatePresignedUploadUrl(
  userId: string,
  type: 'deck' | 'script' | 'video',
  fileName: string,
  mimeType: string,
  expiresIn = 3600 // 1 hour
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  // Validate file type
  const typeValidation = validateFileType(fileName, mimeType, type);
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error);
  }

  const key = generateFileKey(userId, type, fileName);
  
  // In production, you'd use AWS SDK to generate a presigned URL
  // For now, return the key for server-side upload
  const endpoint = getR2Endpoint();
  const uploadUrl = `${endpoint}/${R2_BUCKET_NAME}/${key}`;

  return {
    uploadUrl,
    key,
    publicUrl: getR2FileUrl(key),
  };
}

// ============================================
// FILE EXTRACTION UTILITIES
// ============================================

// Extract text from PDF (simplified - in production use pdf-parse or similar)
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Note: In production, use a library like pdf-parse
  // This is a placeholder that would need actual implementation
  
  // For now, return a message indicating we need the PDF content
  return `[PDF content extraction - file size: ${buffer.length} bytes]`;
}

// Extract text from PowerPoint (simplified)
export async function extractTextFromPPTX(buffer: Buffer): Promise<string> {
  // Note: In production, use a library like pptx-parser
  // This is a placeholder
  
  return `[PowerPoint content extraction - file size: ${buffer.length} bytes]`;
}

// Get file content as text for analysis
export async function getFileContent(url: string, fileType: string): Promise<string> {
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  
  if (fileType === 'application/pdf' || fileType.endsWith('.pdf')) {
    return extractTextFromPDF(buffer);
  } else if (fileType.includes('presentation') || fileType.endsWith('.pptx') || fileType.endsWith('.ppt')) {
    return extractTextFromPPTX(buffer);
  } else if (fileType === 'text/plain' || fileType.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }
  
  throw new Error(`Unsupported file type: ${fileType}`);
}

// ============================================
// MOCK STORAGE (Development Mode)
// ============================================

// For development when R2 is not configured
const mockStorage = new Map<string, { buffer: Buffer; metadata: object }>();

export async function mockUpload(
  file: Buffer | File,
  userId: string,
  type: 'deck' | 'script' | 'video',
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
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

  const key = generateFileKey(userId, type, originalName);
  
  // Store in memory (development only)
  mockStorage.set(key, { 
    buffer, 
    metadata: { originalName, mimeType, fileSize } 
  });

  return {
    key,
    url: `mock://${key}`,
    fileName: originalName,
    fileSize,
    fileType: mimeType,
  };
}

// Unified upload function that handles both R2 and mock
export async function uploadFile(
  file: Buffer | File,
  userId: string,
  type: 'deck' | 'script' | 'video',
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  if (isR2Configured()) {
    return uploadToR2(file, userId, type, originalName, mimeType);
  }
  
  // Use mock storage in development
  console.warn('R2 not configured, using mock storage');
  return mockUpload(file, userId, type, originalName, mimeType);
}
