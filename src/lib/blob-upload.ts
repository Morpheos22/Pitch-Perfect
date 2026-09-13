/**
 * Blob upload module — re-exports from Cloudflare R2 storage.
 * Backward compatibility for '@/lib/blob-upload' imports.
 */
import { uploadToR2, isR2Configured } from './cloudflare-storage';

export { uploadToR2, isR2Configured };

/**
 * Upload a file to R2 storage.
 * Legacy function name used by dashboard pages.
 * Accepts (file, options, type?) — type is a string like "video", "deck", "script".
 */
export async function uploadFileToBlob(
  file: File | Blob | ArrayBuffer | Buffer,
  options?: { filename?: string; contentType?: string; folder?: string } | string,
  type?: string | ((progress: number) => void)
): Promise<{ url: string; key: string; pathname: string; size: number; contentType: string }> {
  // Handle case where second arg is a string (old calling convention: file, "video", callback)
  const opts: { filename?: string; contentType?: string; folder?: string } =
    typeof options === 'string'
      ? { folder: options }
      : (options || {});

  // Handle case where third arg is a function (progress callback — ignored for R2)
  const folder = opts.folder || (typeof type === 'string' ? type : undefined) || 'uploads';

  const buffer = file instanceof Buffer
    ? file
    : file instanceof Blob
      ? Buffer.from(await file.arrayBuffer())
      : Buffer.from(new Uint8Array(file as ArrayBuffer));

  const result = await uploadToR2(buffer, {
    filename: opts.filename || (file instanceof File ? file.name : undefined),
    contentType: opts.contentType || (file instanceof Blob ? file.type : undefined),
    folder,
  });

  return { ...result, pathname: result.key };
}
