// src/lib/blob-upload.ts
// Client-side Blob upload utility using @vercel/blob client-side uploads.
//
// CRITICAL FIX: Previous version posted files to /api/blob/upload as FormData,
// which hit Vercel's 4.5MB serverless body limit. This version uses the
// @vercel/blob/client upload() function, which uploads files DIRECTLY from
// the browser to Vercel Blob storage — completely bypassing the serverless
// function body limit.
//
// FLOW:
//   1. upload(filename, file, { access: 'private', handleUploadUrl, clientPayload })
//   2. Internally: browser → lightweight JSON request to /api/blob/upload for token
//   3. Server validates auth + category, returns client token with constraints
//   4. Browser uploads file directly to Vercel Blob using the token
//   5. Returns { url, pathname } — the blob URL for the coach API
//
// This supports files of ANY size up to the category limit (50MB deck, 10MB script, 500MB video).

// Allowed file formats per category — enforced client-side BEFORE upload
const ALLOWED_FORMATS: Record<string, { extensions: string[]; mimeTypes: string[]; maxSize: number }> = {
  deck: {
    extensions: [".pdf", ".pptx", ".ppt"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  script: {
    extensions: [".pdf", ".docx", ".doc", ".txt"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ],
    maxSize: 10 * 1024 * 1024, // 10MB (must match server MAX_FILE_SIZES in blob/upload/route.ts)
  },
  video: {
    extensions: [".mp4", ".webm", ".mov", ".avi"],
    mimeTypes: [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
    ],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
};

/**
 * Validate file format before upload. Throws if invalid.
 */
export function validateFileFormat(file: File, category: "deck" | "script" | "video"): void {
  const format = ALLOWED_FORMATS[category];
  if (!format) {
    throw new Error(`Unknown upload category: ${category}`);
  }

  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
  if (!format.extensions.includes(ext)) {
    throw new Error(
      `Unsupported file format "${ext}". Accepted: ${format.extensions.join(", ")}`
    );
  }

  // Check MIME type if available (some browsers don't report it)
  if (file.type && file.type !== "application/octet-stream") {
    if (!format.mimeTypes.includes(file.type) && !format.extensions.includes(ext)) {
      throw new Error(
        `Invalid file type "${file.type}". Accepted: ${format.extensions.join(", ")}`
      );
    }
  }

  if (file.size > format.maxSize) {
    const maxMB = (format.maxSize / (1024 * 1024)).toFixed(0);
    throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum: ${maxMB}MB`);
  }
}

export interface BlobUploadResult {
  url: string;       // Full blob URL (e.g. https://<store-slug>.blob.vercel-storage.com/deck/...)
  pathname: string;  // Blob pathname for reference
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
 * @returns Promise with blob URL and pathname
 */
export async function uploadFileToBlob(
  file: File,
  category: "deck" | "script" | "video",
): Promise<BlobUploadResult> {
  // Validate file format before uploading
  validateFileFormat(file, category);

  // Dynamic import — @vercel/blob/client is a client-side module
  // that must only run in the browser (not during SSR)
  const { upload } = await import("@vercel/blob/client");

  // Use client-side upload — file goes directly from browser to Vercel Blob
  // The handleUploadUrl tells the SDK where to request a client token
  // clientPayload carries the category so the server can validate constraints
  const blob = await upload(file.name, file, {
    access: "private",
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({ category }),
    // Use multipart for files > 10MB for better reliability
    multipart: file.size > 10 * 1024 * 1024,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}
