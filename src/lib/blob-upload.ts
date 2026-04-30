// src/lib/blob-upload.ts
// Client-side Blob upload utility using @vercel/blob client-side uploads.
//
// FLOW:
//   1. upload(filename, file, { access: 'public', handleUploadUrl, clientPayload })
//   2. Internally: browser → lightweight JSON request to /api/blob/upload for token
//   3. Server validates auth + category, returns client token with constraints
//   4. Browser uploads file directly to Vercel Blob using the token
//   5. Returns { url, pathname } — the blob URL for the coach API
//
// NOTE: The Vercel Blob store for this project is a PUBLIC store.
// Using access: 'private' would fail with "Cannot use private access on a public store".
// Public blob URLs are not easily guessable (random suffix), providing adequate security.
//
// File validation is imported from lib/file-validation.ts — the single source of truth.

import {
  validateFileFormat,
  type FileCategory,
} from '@/lib/file-validation';

export interface BlobUploadResult {
  url: string;       // Full blob URL (e.g. https://<store-slug>.blob.vercel-storage.com/deck/...)
  pathname: string;  // Blob pathname for reference
}

/** Progress event from the upload() function */
export interface UploadProgressEvent {
  loaded: number;     // Bytes uploaded so far
  total: number;      // Total bytes to upload
  percentage: number; // Upload progress as a percentage (0-100)
}

/**
 * Upload a file to Vercel Blob storage using client-side direct upload.
 *
 * This uses @vercel/blob/client upload() which sends the file directly
 * from the browser to Vercel Blob, bypassing Vercel's serverless body
 * size limit entirely. Only a lightweight token request goes to our server.
 *
 * @param file - The File object to upload
 * @param category - Upload category: "deck", "script", or "video"
 * @param onUploadProgress - Optional callback for upload progress tracking
 * @returns Promise with blob URL and pathname
 */
export async function uploadFileToBlob(
  file: File,
  category: FileCategory,
  onUploadProgress?: (progress: UploadProgressEvent) => void,
): Promise<BlobUploadResult> {
  // Validate file format before uploading (uses single source of truth)
  validateFileFormat(file, category);

  try {
    // Dynamic import — @vercel/blob/client is a client-side module
    // that must only run in the browser (not during SSR)
    const { upload } = await import("@vercel/blob/client");

    // Use client-side upload — file goes directly from browser to Vercel Blob
    // The handleUploadUrl tells the SDK where to request a client token
    // clientPayload carries the category so the server can validate constraints
    //
    // IMPORTANT: access must be "public" because the Vercel Blob store for this
    // project is a public store. Private access would cause the upload to fail with
    // "Cannot use private access on a public store".
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/blob/upload",
      clientPayload: JSON.stringify({ category }),
      // Use multipart for files > 10MB for better reliability
      multipart: file.size > 10 * 1024 * 1024,
      // Pass through progress callback for UI feedback
      onUploadProgress: onUploadProgress,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
    };
  } catch (error: unknown) {
    // Provide user-friendly error messages based on common failure modes
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes('Unauthorized') || msg.includes('401')) {
      throw new Error('You must be signed in to upload files. Please sign in and try again.');
    }
    if (msg.includes('Invalid file type') || msg.includes('allowedContentTypes')) {
      throw new Error(`File type not accepted for ${category} uploads. Please check the supported formats.`);
    }
    if (msg.includes('maximumSizeInBytes') || msg.includes('size') || msg.includes('too large')) {
      throw new Error('File is too large. Please reduce the file size and try again.');
    }
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('network')) {
      throw new Error('Network error during upload. Please check your internet connection and try again.');
    }
    if (msg.includes('Cannot use private access on a public store')) {
      throw new Error('Storage configuration error. Please contact support.');
    }

    // Re-throw with the original message if no specific match
    throw error;
  }
}
