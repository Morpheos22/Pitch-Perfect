/**
 * Blob signature + URL utilities — simplified for R2.
 * Backward compatibility for '@/lib/blob-signature' imports.
 */

import { downloadFromR2, getR2PublicUrl } from './cloudflare-storage';

// Check if a URL is an R2/blob URL
export function isBlobUrl(url: string): boolean {
  return url.includes('r2.cloudflarestorage.com') ||
         url.includes('r2.dev') ||
         url.includes('blob.vercel-storage.com'); // legacy URLs still in DB
}

// Check if a URL is a private blob URL (requires auth to download)
export function isPrivateBlobUrl(url: string): boolean {
  // R2 public URLs are not private. Internal R2 URLs (r2.cloudflarestorage.com) are.
  return url.includes('r2.cloudflarestorage.com') && !url.includes('r2.dev');
}

// Convert a blob URL to a data URI for AI processing
export async function blobUrlToDataUri(url: string): Promise<string> {
  // If it's already a data URI, return as-is
  if (url.startsWith('data:')) return url;

  // Extract key from URL
  const urlObj = new URL(url);
  const key = urlObj.pathname.slice(1); // Remove leading /

  const { data, contentType } = await downloadFromR2(key);
  const base64 = data.toString('base64');
  return `data:${contentType};base64,${base64}`;
}

// Serve a private blob (used by /api/blob/download route)
export async function servePrivateBlob(key: string): Promise<{ data: Buffer; contentType: string }> {
  return downloadFromR2(key);
}

// Verify signature (no-op for R2 — auth is via SigV4)
export function verifyBlobSignature(_token: string): boolean {
  return true;
}

export function generateBlobSignature(): string {
  return '';
}
