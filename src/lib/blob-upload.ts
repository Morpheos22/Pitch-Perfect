// src/lib/blob-upload.ts
// Client-side Blob upload utility.
//
// FLOW:
//   1. POST /api/blob/upload with FormData { file, category }
//   2. Server uploads to Vercel Blob using @vercel/blob put()
//   3. Returns { url, pathname } — the blob URL for the coach API
//
// FALLBACK:
//   If blob upload fails (e.g. no BLOB_READ_WRITE_TOKEN), the caller
//   falls back to sending the file directly to /api/coach/deck as FormData.
//   This works for files under 4.5MB (Vercel serverless body limit).

// Allowed file formats per category — enforced client-side BEFORE upload
const ALLOWED_FORMATS: Record<string, { extensions: string[]; mimeTypes: string[]; maxSize: number }> = {
  deck: {
    extensions: [".pdf", ".pptx", ".ppt"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxSize: 50 * 1024 * 1024, // 50MB (validated client-side; server enforces 4.5MB for serverless)
  },
  script: {
    extensions: [".pdf", ".docx", ".doc", ".txt"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ],
    maxSize: 50 * 1024 * 1024,
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
  url: string;       // Full blob URL (e.g. https://public.blob.vercel-storage.com/deck/...)
  pathname: string;  // Blob pathname for reference
}

/**
 * Upload a file to Vercel Blob storage via our server-side proxy route.
 * The server handles the actual @vercel/blob put() call.
 */
export async function uploadFileToBlob(
  file: File,
  category: "deck" | "script" | "video",
): Promise<BlobUploadResult> {
  // Validate file format before uploading
  validateFileFormat(file, category);

  // POST the file to our server-side upload route
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const res = await fetch("/api/blob/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || `Upload failed (${res.status})`
    );
  }

  const result = (await res.json()) as {
    url: string;
    pathname: string;
    downloadUrl?: string;
  };

  return {
    url: result.url,
    pathname: result.pathname || result.downloadUrl || result.url,
  };
}
