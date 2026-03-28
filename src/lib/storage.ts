// Cloudflare R2 Storage Utilities
// Handles file uploads for PDF, PPTX, and video files
//
// Environment Variables (set in Vercel):
// - CLOUDFLARE_ACCOUNT_ID: Your Cloudflare account ID
// - CLOUDFLARE_R2_ACCESS_KEY_ID: R2 access key ID (S3 API token)
// - CLOUDFLARE_R2_SECRET_ACCESS_KEY: R2 secret access key
// - CLOUDFLARE_R2_BUCKET_NAME: R2 bucket name
// - CLOUDFLARE_R2_PUBLIC_URL: Public URL for accessing files (optional)

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pitch-perfect';
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

// Check if R2 is configured
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

// Create R2/S3 client
function createR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured. Please set environment variables.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
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
// UPLOAD RESULT INTERFACE
// ============================================

export interface UploadResult {
  key: string;
  url: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

// ============================================
// UPLOAD FUNCTIONS
// ============================================

// Upload file to R2
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

  // Validate file type
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

  // Upload to R2
  const client = createR2Client();
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      'original-filename': originalName,
      'user-id': userId,
      'type': type,
    },
  });

  await client.send(command);

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
// For direct client-side uploads (bypasses Vercel 4.5MB limit)
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
  const client = createR2Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
    Metadata: {
      'original-filename': fileName,
      'user-id': userId,
      'type': type,
    },
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    uploadUrl,
    key,
    publicUrl: getR2FileUrl(key),
  };
}

// Generate presigned download URL
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// Delete file from R2
export async function deleteFromR2(key: string): Promise<void> {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const client = createR2Client();
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
}

// ============================================
// FILE CONTENT EXTRACTION
// ============================================

// Get file content from R2
export async function getFileBuffer(key: string): Promise<Buffer> {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const client = createR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);
  const stream = response.Body;
  
  if (!stream) {
    throw new Error('No file content found');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

// Alias for getFileBuffer (backwards compatibility)
export const getFileContent = getFileBuffer;

// ============================================
// DOCUMENT PARSING INTEGRATION
// ============================================

/**
 * Extract text content from an uploaded file
 * Combines R2 download with document parsing
 */
export async function extractFileText(
  key: string,
  mimeType: string,
  fileName?: string
): Promise<{ text: string; wordCount: number; pageCount?: number; slideCount?: number }> {
  // Get the file buffer from R2
  const buffer = await getFileBuffer(key);
  
  // Parse the document
  const { parseDocument } = await import('./document-parser');
  const result = await parseDocument(buffer, mimeType, fileName);
  
  return {
    text: result.text,
    wordCount: result.wordCount,
    pageCount: result.pageCount,
    slideCount: result.slideCount,
  };
}

// ============================================
// MOCK STORAGE (Development Mode - when R2 not configured)
// ============================================

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
