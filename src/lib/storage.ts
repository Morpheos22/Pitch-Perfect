/**
 * Storage module — re-exports from Cloudflare R2 storage.
 * This file exists for backward compatibility with code that imports from '@/lib/storage'.
 */
import { uploadToR2, downloadFromR2, deleteFromR2, getR2PublicUrl, isR2Configured } from './cloudflare-storage';

export {
  downloadFromR2 as download,
  deleteFromR2 as del,
  getR2PublicUrl,
  isR2Configured,
  isR2Configured as isStorageConfigured,
};

// Legacy uploadFile wrapper — accepts old 5-arg signature (file, userId, folder, filename, contentType)
export async function uploadFile(
  file: File | Blob | ArrayBuffer | Buffer,
  _userId?: string,
  folder?: string,
  filename?: string,
  contentType?: string
): Promise<{ url: string; key: string; pathname: string; size: number; contentType: string }> {
  const buffer = file instanceof Buffer
    ? file
    : file instanceof Blob
      ? Buffer.from(await file.arrayBuffer())
      : Buffer.from(new Uint8Array(file as ArrayBuffer));

  const result = await uploadToR2(buffer, {
    filename: filename || (file instanceof File ? file.name : undefined),
    contentType: contentType || (file instanceof Blob ? file.type : undefined),
    folder: folder || 'uploads',
  });

  return { ...result, pathname: result.key };
}

// Also export as 'upload' for other callers
export { uploadFile as upload };

// Allowed upload hosts (for URL validation in API routes)
export const ALLOWED_UPLOAD_HOSTS = [
  'r2.cloudflarestorage.com',
  'r2.dev',
  'blob.vercel-storage.com', // legacy URLs still in DB
  'public.blob.vercel-storage.com',
];

export const ALLOWED_VIDEO_HOSTS = [
  'r2.cloudflarestorage.com',
  'r2.dev',
  'blob.vercel-storage.com',
  'public.blob.vercel-storage.com',
];

// Check if a URL host is in the allowed list
export function isHostAllowed(url: string, hosts: string[] = ALLOWED_UPLOAD_HOSTS): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hosts.some(h => hostname.includes(h));
  } catch {
    return false;
  }
}

// Legacy aliases for backward compatibility
export function getStorageBackend(): string {
  return 'cloudflare-r2';
}

export function isVercelBlobConfigured(): boolean {
  return false; // Vercel Blob removed — using R2
}

// Legacy function — downloads a file and returns its content as text/buffer
export async function getFileContent(url: string): Promise<Buffer> {
  const { downloadFromR2 } = await import('./cloudflare-storage');
  // Extract key from URL
  const urlObj = new URL(url);
  const key = urlObj.pathname.slice(1);
  const { data } = await downloadFromR2(key);
  return data;
}
